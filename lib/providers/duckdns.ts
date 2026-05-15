import { ProviderType } from "@prisma/client";
import { fetchWithTimeout } from "@/lib/providers/common";
import { DnsProviderAdapter } from "@/lib/providers/types";

export const duckDnsProvider: DnsProviderAdapter = {
  type: ProviderType.DUCKDNS,
  displayName: "DuckDNS",
  defaultName: "DuckDNS",
  tokenLabel: "DuckDNS Token",
  tokenPlaceholder: "DuckDNS token",
  zoneLabel: "Zone",
  zonePlaceholder: "duckdns.org",
  recordLabel: "DuckDNS subdomain",
  recordPlaceholder: "home",
  async updateRecord({ record, ip, settings }) {
    const lDomain = record.recordName.replace(/\.duckdns\.org$/i, "");
    const lQuery = new URLSearchParams({
      domains: lDomain,
      token: record.provider.apiToken,
      verbose: "true",
    });

    if (record.recordType === "A") {
      lQuery.set("ip", ip);
    } else {
      lQuery.set("ipv6", ip);
    }

    const lUrl = `https://www.duckdns.org/update?${lQuery.toString()}`;
    const lResponse = await fetchWithTimeout(lUrl, settings);
    const lText = await lResponse.text();

    if (!lResponse.ok || !lText.toUpperCase().includes("OK")) {
      throw new Error(`DuckDNS API ${lResponse.status}: ${lText.slice(0, 240)}`);
    }

    return { changed: true, message: `DuckDNS record updated: ${ip}` };
  },
};
