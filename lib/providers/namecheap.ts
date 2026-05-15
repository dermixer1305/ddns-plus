import { ProviderType } from "@prisma/client";
import { fetchWithTimeout, parseJsonCredentials, relativeRecordName } from "@/lib/providers/common";
import { DnsProviderAdapter } from "@/lib/providers/types";
import { RuntimeSettings } from "@/lib/settings";

type NamecheapCredentials = {
  apiUser: string;
  apiKey: string;
  username?: string;
  clientIp: string;
  sandbox?: boolean;
};

type NamecheapHost = {
  name: string;
  type: string;
  address: string;
  mxPref: string;
  ttl: string;
};

function getNamecheapCredentials(pRawValue: string) {
  const lCredentials = parseJsonCredentials<NamecheapCredentials>(pRawValue, "Namecheap");
  return {
    ...lCredentials,
    username: lCredentials.username || lCredentials.apiUser,
  };
}

function splitNamecheapDomain(pDomain: string) {
  const lParts = pDomain.split(".");
  if (lParts.length < 2) throw new Error("Namecheap domain must include SLD and TLD, for example example.com");
  return {
    sld: lParts.slice(0, -1).join("."),
    tld: lParts.at(-1) || "",
  };
}

function parseAttributes(pTag: string) {
  const lAttributes: Record<string, string> = {};
  for (const lMatch of pTag.matchAll(/(\w+)="([^"]*)"/g)) {
    lAttributes[lMatch[1]] = lMatch[2];
  }
  return lAttributes;
}

function parseNamecheapHosts(pXml: string) {
  return [...pXml.matchAll(/<Host\s+([^>]+?)\s*\/>/g)].map((pMatch) => {
    const lAttributes = parseAttributes(pMatch[1]);
    return {
      name: lAttributes.Name || "@",
      type: lAttributes.Type || "",
      address: lAttributes.Address || "",
      mxPref: lAttributes.MXPref || "10",
      ttl: lAttributes.TTL || "1800",
    } satisfies NamecheapHost;
  });
}

function assertNamecheapOk(pXml: string) {
  if (/Status="OK"/.test(pXml)) return;
  const lErrors = [...pXml.matchAll(/<Error[^>]*>([^<]+)<\/Error>/g)].map((pMatch) => pMatch[1]).join(", ");
  throw new Error(`Namecheap API error: ${lErrors || pXml.slice(0, 240)}`);
}

async function namecheapRequest(
  pCredentials: ReturnType<typeof getNamecheapCredentials>,
  pCommand: string,
  pParams: Record<string, string>,
  pSettings: RuntimeSettings,
) {
  const lBaseUrl = pCredentials.sandbox
    ? "https://api.sandbox.namecheap.com/xml.response"
    : "https://api.namecheap.com/xml.response";
  const lQuery = new URLSearchParams({
    ApiUser: pCredentials.apiUser,
    ApiKey: pCredentials.apiKey,
    UserName: pCredentials.username,
    ClientIp: pCredentials.clientIp,
    Command: pCommand,
    ...pParams,
  });
  const lUrl = `${lBaseUrl}?${lQuery.toString()}`;
  const lResponse = await fetchWithTimeout(lUrl, pSettings);
  const lText = await lResponse.text();

  if (!lResponse.ok) {
    throw new Error(`Namecheap API ${lResponse.status}: ${lText.slice(0, 240)}`);
  }

  assertNamecheapOk(lText);
  return lText;
}

export const namecheapProvider: DnsProviderAdapter = {
  type: ProviderType.NAMECHEAP,
  displayName: "Namecheap DNS",
  defaultName: "Namecheap DNS",
  tokenLabel: "Namecheap Credentials JSON",
  tokenPlaceholder: "{\"apiUser\":\"user\",\"apiKey\":\"key\",\"clientIp\":\"203.0.113.10\"}",
  zoneLabel: "Domain",
  zonePlaceholder: "example.com",
  recordLabel: "Host name",
  recordPlaceholder: "home or @",
  async updateRecord({ record, ip, settings }) {
    const lCredentials = getNamecheapCredentials(record.provider.apiToken);
    const lDomain = splitNamecheapDomain(record.zoneId);
    const lRecordName = relativeRecordName(record.recordName, record.zoneId);
    const lCurrentXml = await namecheapRequest(
      lCredentials,
      "namecheap.domains.dns.getHosts",
      { SLD: lDomain.sld, TLD: lDomain.tld },
      settings,
    );
    const lHosts = parseNamecheapHosts(lCurrentXml);
    const lExisting = lHosts.find((pHost) => pHost.name === lRecordName && pHost.type === record.recordType);
    const lNextHosts = lExisting
      ? lHosts.map((pHost) => pHost === lExisting ? { ...pHost, address: ip, ttl: String(record.ttl) } : pHost)
      : [...lHosts, { name: lRecordName, type: record.recordType, address: ip, mxPref: "10", ttl: String(record.ttl) }];

    if (lExisting?.address === ip && Number(lExisting.ttl) === record.ttl) {
      return { changed: false, message: "IP is already current", previousValues: [lExisting.address] };
    }

    const lParams: Record<string, string> = { SLD: lDomain.sld, TLD: lDomain.tld };
    lNextHosts.forEach((pHost, pIndex) => {
      const lIndex = String(pIndex + 1);
      lParams[`HostName${lIndex}`] = pHost.name;
      lParams[`RecordType${lIndex}`] = pHost.type;
      lParams[`Address${lIndex}`] = pHost.address;
      lParams[`MXPref${lIndex}`] = pHost.mxPref;
      lParams[`TTL${lIndex}`] = pHost.ttl;
    });

    await namecheapRequest(lCredentials, "namecheap.domains.dns.setHosts", lParams, settings);

    return {
      changed: true,
      message: lExisting ? `DNS record updated: ${lExisting.address} -> ${ip}` : `DNS record created: ${ip}`,
      previousValues: lExisting ? [lExisting.address] : undefined,
    };
  },
};
