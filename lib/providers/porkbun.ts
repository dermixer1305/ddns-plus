import { ProviderType } from "@prisma/client";
import {
  fetchWithTimeout,
  parseJsonCredentials,
  readJsonResponse,
  relativeRecordName,
} from "@/lib/providers/common";
import { DnsProviderAdapter } from "@/lib/providers/types";
import { RuntimeSettings } from "@/lib/settings";

type PorkbunCredentials = {
  apikey: string;
  secretapikey: string;
};

type PorkbunRecord = {
  id: string;
  name: string;
  type: "A" | "AAAA";
  content: string;
  ttl: string;
};

type PorkbunResponse<T> = T & {
  status: "SUCCESS" | "ERROR";
  message?: string;
};

function getPorkbunCredentials(pRawValue: string) {
  return parseJsonCredentials<PorkbunCredentials>(pRawValue, "Porkbun");
}

async function porkbunRequest<T>(
  pCredentials: PorkbunCredentials,
  pPath: string,
  pSettings: RuntimeSettings,
  pInit?: RequestInit,
) {
  const lUrl = `https://api.porkbun.com/api/json/v3${pPath}`;
  const lResponse = await fetchWithTimeout(lUrl, pSettings, {
    ...pInit,
    headers: {
      "Content-Type": "application/json",
      ...(pInit?.headers || {}),
    },
    body: pInit?.body ?? JSON.stringify(pCredentials),
  });
  const lBody = await readJsonResponse<PorkbunResponse<T>>(lResponse, lUrl, "Porkbun");

  if (lBody.status !== "SUCCESS") {
    throw new Error(`Porkbun API: ${lBody.message || "Request failed"}`);
  }

  return lBody;
}

export const porkbunProvider: DnsProviderAdapter = {
  type: ProviderType.PORKBUN,
  displayName: "Porkbun DNS",
  defaultName: "Porkbun DNS",
  tokenLabel: "Porkbun Credentials JSON",
  tokenPlaceholder: "{\"apikey\":\"pk1_...\",\"secretapikey\":\"sk1_...\"}",
  zoneLabel: "Domain",
  zonePlaceholder: "example.com",
  recordLabel: "Subdomain",
  recordPlaceholder: "home or empty for root",
  async updateRecord({ record, ip, settings }) {
    const lCredentials = getPorkbunCredentials(record.provider.apiToken);
    const lDomain = record.zoneId;
    const lSubdomain = relativeRecordName(record.recordName, lDomain);
    const lLookupSubdomain = lSubdomain === "@" ? "" : lSubdomain;
    const lLookup = await porkbunRequest<{ records: PorkbunRecord[] }>(
      lCredentials,
      `/dns/retrieveByNameType/${encodeURIComponent(lDomain)}/${record.recordType}/${encodeURIComponent(lLookupSubdomain)}`,
      settings,
    );
    const lExisting = lLookup.records[0] ?? null;

    if (!lExisting) {
      await porkbunRequest(lCredentials, `/dns/create/${encodeURIComponent(lDomain)}`, settings, {
        method: "POST",
        body: JSON.stringify({
          ...lCredentials,
          name: lLookupSubdomain,
          type: record.recordType,
          content: ip,
          ttl: record.ttl,
        }),
      });

      return { changed: true, message: `DNS record created: ${ip}` };
    }

    if (lExisting.content === ip && Number(lExisting.ttl) === record.ttl) {
      return { changed: false, message: "IP is already current", previousValues: [lExisting.content] };
    }

    await porkbunRequest(lCredentials, `/dns/edit/${encodeURIComponent(lDomain)}/${encodeURIComponent(lExisting.id)}`, settings, {
      method: "POST",
      body: JSON.stringify({
        ...lCredentials,
        type: record.recordType,
        content: ip,
        ttl: record.ttl,
      }),
    });

    return {
      changed: true,
      message: `DNS record updated: ${lExisting.content} -> ${ip}`,
      previousValues: [lExisting.content],
    };
  },
};
