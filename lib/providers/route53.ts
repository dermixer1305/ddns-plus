import { createHash, createHmac } from "node:crypto";
import { ProviderType } from "@prisma/client";
import { ensureTrailingDot, fetchWithTimeout, parseJsonCredentials } from "@/lib/providers/common";
import { DnsProviderAdapter } from "@/lib/providers/types";
import { RuntimeSettings } from "@/lib/settings";

type Route53Credentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
};

function hmac(pKey: Buffer | string, pValue: string) {
  return createHmac("sha256", pKey).update(pValue).digest();
}

function hash(pValue: string) {
  return createHash("sha256").update(pValue).digest("hex");
}

function toAmzDate(pDate: Date) {
  return pDate.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function toDateStamp(pDate: Date) {
  return pDate.toISOString().slice(0, 10).replace(/-/g, "");
}

function escapeXml(pValue: string) {
  return pValue
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getTagValue(pXml: string, pTagName: string) {
  return pXml.match(new RegExp(`<${pTagName}>([^<]*)</${pTagName}>`))?.[1] ?? null;
}

function parseRoute53Record(pXml: string, pName: string, pType: string) {
  const lRecordSets = [...pXml.matchAll(/<ResourceRecordSet>([\s\S]*?)<\/ResourceRecordSet>/g)].map((pMatch) => pMatch[1]);
  const lRecordSet = lRecordSets.find((pRecordSet) => {
    return getTagValue(pRecordSet, "Name") === pName && getTagValue(pRecordSet, "Type") === pType;
  });

  if (!lRecordSet) return null;

  return {
    ttl: Number(getTagValue(lRecordSet, "TTL") || "0"),
    values: [...lRecordSet.matchAll(/<Value>([^<]*)<\/Value>/g)].map((pMatch) => pMatch[1]),
  };
}

function signRoute53Request(
  pCredentials: Route53Credentials,
  pMethod: string,
  pPath: string,
  pQuery: string,
  pBody: string,
) {
  const lNow = new Date();
  const lAmzDate = toAmzDate(lNow);
  const lDateStamp = toDateStamp(lNow);
  const lPayloadHash = hash(pBody);
  const lHeaders: Record<string, string> = {
    host: "route53.amazonaws.com",
    "x-amz-content-sha256": lPayloadHash,
    "x-amz-date": lAmzDate,
  };

  if (pCredentials.sessionToken) {
    lHeaders["x-amz-security-token"] = pCredentials.sessionToken;
  }

  const lSignedHeaders = Object.keys(lHeaders).sort().join(";");
  const lCanonicalHeaders = Object.keys(lHeaders)
    .sort()
    .map((pKey) => `${pKey}:${lHeaders[pKey]}\n`)
    .join("");
  const lCanonicalRequest = [
    pMethod,
    pPath,
    pQuery,
    lCanonicalHeaders,
    lSignedHeaders,
    lPayloadHash,
  ].join("\n");
  const lCredentialScope = `${lDateStamp}/us-east-1/route53/aws4_request`;
  const lStringToSign = [
    "AWS4-HMAC-SHA256",
    lAmzDate,
    lCredentialScope,
    hash(lCanonicalRequest),
  ].join("\n");
  const lSigningKey = hmac(
    hmac(hmac(hmac(`AWS4${pCredentials.secretAccessKey}`, lDateStamp), "us-east-1"), "route53"),
    "aws4_request",
  );
  const lSignature = createHmac("sha256", lSigningKey).update(lStringToSign).digest("hex");

  return {
    ...lHeaders,
    Authorization:
      `AWS4-HMAC-SHA256 Credential=${pCredentials.accessKeyId}/${lCredentialScope}, ` +
      `SignedHeaders=${lSignedHeaders}, Signature=${lSignature}`,
  };
}

async function route53Request(
  pCredentials: Route53Credentials,
  pMethod: string,
  pPath: string,
  pSettings: RuntimeSettings,
  pQuery = "",
  pBody = "",
) {
  const lHeaders = signRoute53Request(pCredentials, pMethod, pPath, pQuery, pBody);
  const lUrl = `https://route53.amazonaws.com${pPath}${pQuery ? `?${pQuery}` : ""}`;
  const lResponse = await fetchWithTimeout(lUrl, pSettings, {
    method: pMethod,
    headers: {
      ...lHeaders,
      "Content-Type": "application/xml",
    },
    body: pBody || undefined,
  });
  const lText = await lResponse.text();

  if (!lResponse.ok) {
    throw new Error(`Route 53 API ${lResponse.status}: ${lText.slice(0, 240)}`);
  }

  return lText;
}

export const route53Provider: DnsProviderAdapter = {
  type: ProviderType.ROUTE53,
  displayName: "Amazon Route 53",
  defaultName: "Amazon Route 53",
  tokenLabel: "AWS Credentials JSON",
  tokenPlaceholder: "{\"accessKeyId\":\"AKIA...\",\"secretAccessKey\":\"...\"}",
  zoneLabel: "Hosted Zone ID",
  zonePlaceholder: "Z1234567890ABC",
  recordLabel: "Record name",
  recordPlaceholder: "home.example.com",
  async updateRecord({ record, ip, settings }) {
    const lCredentials = parseJsonCredentials<Route53Credentials>(record.provider.apiToken, "Route 53");
    const lHostedZoneId = record.zoneId.replace(/^\/hostedzone\//, "");
    const lRecordName = ensureTrailingDot(record.hostname);
    const lListQuery = new URLSearchParams([
      ["maxitems", "1"],
      ["name", lRecordName],
      ["type", record.recordType],
    ]).toString();
    const lListXml = await route53Request(
      lCredentials,
      "GET",
      `/2013-04-01/hostedzone/${encodeURIComponent(lHostedZoneId)}/rrset`,
      settings,
      lListQuery,
    );
    const lExisting = parseRoute53Record(lListXml, lRecordName, record.recordType);

    if (lExisting?.values.length === 1 && lExisting.values[0] === ip && lExisting.ttl === record.ttl) {
      return { changed: false, message: "IP is already current", previousValues: lExisting.values };
    }

    const lBody =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<ChangeResourceRecordSetsRequest xmlns="https://route53.amazonaws.com/doc/2013-04-01/">' +
      "<ChangeBatch><Changes><Change><Action>UPSERT</Action><ResourceRecordSet>" +
      `<Name>${escapeXml(lRecordName)}</Name>` +
      `<Type>${record.recordType}</Type>` +
      `<TTL>${record.ttl}</TTL>` +
      `<ResourceRecords><ResourceRecord><Value>${escapeXml(ip)}</Value></ResourceRecord></ResourceRecords>` +
      "</ResourceRecordSet></Change></Changes></ChangeBatch>" +
      "</ChangeResourceRecordSetsRequest>";

    await route53Request(
      lCredentials,
      "POST",
      `/2013-04-01/hostedzone/${encodeURIComponent(lHostedZoneId)}/rrset`,
      settings,
      "",
      lBody,
    );

    return {
      changed: true,
      message: lExisting ? `DNS record updated: ${lExisting.values.join(", ") || "-"} -> ${ip}` : `DNS record upserted: ${ip}`,
      previousValues: lExisting?.values,
    };
  },
};
