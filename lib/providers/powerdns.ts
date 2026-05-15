import { ProviderType } from "@prisma/client";
import {
  buildFqdn,
  ensureTrailingDot,
  fetchWithTimeout,
  parseJsonCredentials,
  readJsonResponse,
} from "@/lib/providers/common";
import { DnsProviderAdapter } from "@/lib/providers/types";
import { RuntimeSettings } from "@/lib/settings";

type PowerDnsCredentials = {
  apiUrl: string;
  apiKey: string;
  serverId?: string;
};

type PowerDnsRrset = {
  name: string;
  type: "A" | "AAAA";
  ttl: number;
  records: Array<{ content: string; disabled: boolean }>;
};

type PowerDnsZone = {
  rrsets?: PowerDnsRrset[];
};

function getPowerDnsCredentials(pRawValue: string) {
  const lCredentials = parseJsonCredentials<PowerDnsCredentials>(pRawValue, "PowerDNS");
  return {
    ...lCredentials,
    apiUrl: lCredentials.apiUrl.replace(/\/$/, ""),
    serverId: lCredentials.serverId || "localhost",
  };
}

async function powerDnsRequest<T>(
  pCredentials: ReturnType<typeof getPowerDnsCredentials>,
  pPath: string,
  pSettings: RuntimeSettings,
  pInit?: RequestInit,
) {
  const lUrl = `${pCredentials.apiUrl}${pPath}`;
  const lResponse = await fetchWithTimeout(lUrl, pSettings, {
    ...pInit,
    headers: {
      "X-API-Key": pCredentials.apiKey,
      "Content-Type": "application/json",
      ...(pInit?.headers || {}),
    },
  });

  if (lResponse.status === 204) return undefined as T;
  return readJsonResponse<T>(lResponse, lUrl, "PowerDNS");
}

export const powerDnsProvider: DnsProviderAdapter = {
  type: ProviderType.POWERDNS,
  displayName: "PowerDNS",
  defaultName: "PowerDNS",
  tokenLabel: "PowerDNS Credentials JSON",
  tokenPlaceholder: "{\"apiUrl\":\"https://pdns.example.com/api/v1\",\"apiKey\":\"secret\",\"serverId\":\"localhost\"}",
  zoneLabel: "Zone ID",
  zonePlaceholder: "example.com.",
  recordLabel: "Record name",
  recordPlaceholder: "home or @",
  async updateRecord({ record, ip, settings }) {
    const lCredentials = getPowerDnsCredentials(record.provider.apiToken);
    const lZoneId = ensureTrailingDot(record.zoneId);
    const lRecordName = ensureTrailingDot(buildFqdn(record.recordName, lZoneId));
    const lZonePath =
      `/servers/${encodeURIComponent(lCredentials.serverId)}/zones/${encodeURIComponent(lZoneId)}`;
    const lZone = await powerDnsRequest<PowerDnsZone>(lCredentials, lZonePath, settings);
    const lExisting = lZone.rrsets?.find((pRrset) => pRrset.name === lRecordName && pRrset.type === record.recordType);
    const lCurrentValues = lExisting?.records.filter((pItem) => !pItem.disabled).map((pItem) => pItem.content) ?? [];

    if (lCurrentValues.length === 1 && lCurrentValues[0] === ip && lExisting?.ttl === record.ttl) {
      return { changed: false, message: "IP is already current", previousValues: lCurrentValues };
    }

    await powerDnsRequest(lCredentials, lZonePath, settings, {
      method: "PATCH",
      body: JSON.stringify({
        rrsets: [
          {
            name: lRecordName,
            type: record.recordType,
            ttl: record.ttl,
            changetype: "REPLACE",
            records: [{ content: ip, disabled: false }],
          },
        ],
      }),
    });

    return {
      changed: true,
      message: lExisting ? `RRset updated: ${lCurrentValues.join(", ") || "-"} -> ${ip}` : `RRset created: ${ip}`,
      previousValues: lCurrentValues,
    };
  },
};
