import { ProviderType } from "@prisma/client";
import { buildFqdn, fetchWithTimeout, readJsonResponse, relativeRecordName } from "@/lib/providers/common";
import { DnsProviderAdapter } from "@/lib/providers/types";
import { RuntimeSettings } from "@/lib/settings";

type DigitalOceanRecord = {
  id: number;
  type: "A" | "AAAA";
  name: string;
  data: string;
  ttl: number;
};

async function digitalOceanRequest<T>(pToken: string, pPath: string, pSettings: RuntimeSettings, pInit?: RequestInit) {
  const lUrl = `https://api.digitalocean.com/v2${pPath}`;
  const lResponse = await fetchWithTimeout(lUrl, pSettings, {
    ...pInit,
    headers: {
      Authorization: `Bearer ${pToken}`,
      "Content-Type": "application/json",
      ...(pInit?.headers || {}),
    },
  });

  return readJsonResponse<T>(lResponse, lUrl, "DigitalOcean");
}

export const digitalOceanProvider: DnsProviderAdapter = {
  type: ProviderType.DIGITALOCEAN,
  displayName: "DigitalOcean DNS",
  defaultName: "DigitalOcean DNS",
  tokenLabel: "Personal Access Token",
  tokenPlaceholder: "DigitalOcean API token",
  zoneLabel: "Domain",
  zonePlaceholder: "example.com",
  recordLabel: "Record name",
  recordPlaceholder: "home or @",
  async updateRecord({ record, ip, settings }) {
    const lDomain = record.zoneId;
    const lRelativeName = relativeRecordName(record.recordName, lDomain);
    const lFqdn = buildFqdn(record.recordName, lDomain);
    const lQuery = new URLSearchParams({ type: record.recordType, name: lFqdn, per_page: "1" });
    const lLookup = await digitalOceanRequest<{ domain_records: DigitalOceanRecord[] }>(
      record.provider.apiToken,
      `/domains/${encodeURIComponent(lDomain)}/records?${lQuery.toString()}`,
      settings,
    );
    const lExisting = lLookup.domain_records[0] ?? null;

    if (!lExisting) {
      await digitalOceanRequest(record.provider.apiToken, `/domains/${encodeURIComponent(lDomain)}/records`, settings, {
        method: "POST",
        body: JSON.stringify({
          type: record.recordType,
          name: lRelativeName,
          data: ip,
          ttl: record.ttl,
        }),
      });

      return { changed: true, message: `DNS record created: ${ip}` };
    }

    if (lExisting.data === ip && lExisting.ttl === record.ttl) {
      return { changed: false, message: "IP is already current", previousValues: [lExisting.data] };
    }

    await digitalOceanRequest(
      record.provider.apiToken,
      `/domains/${encodeURIComponent(lDomain)}/records/${lExisting.id}`,
      settings,
      {
        method: "PUT",
        body: JSON.stringify({
          type: record.recordType,
          name: lExisting.name,
          data: ip,
          ttl: record.ttl,
        }),
      },
    );

    return {
      changed: true,
      message: `DNS record updated: ${lExisting.data} -> ${ip}`,
      previousValues: [lExisting.data],
    };
  },
};
