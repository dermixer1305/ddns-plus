import { ProviderType } from "@prisma/client";
import { describeFetchError, timeoutSignal } from "@/lib/http";
import { DnsProviderAdapter } from "@/lib/providers/types";
import { RuntimeSettings } from "@/lib/settings";

type HetznerRecord = {
  id: string;
  name: string;
  type: "A" | "AAAA";
  ttl: number | null;
  records: Array<{ value: string; comment?: string }>;
  zone: number;
};

class HetznerApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function encodePathPart(value: string) {
  return encodeURIComponent(value).replace(/%2F/gi, "%252F");
}

async function hetznerRequest<T>(token: string, path: string, settings: RuntimeSettings, init?: RequestInit) {
  const url = `https://api.hetzner.cloud/v1${path}`;
  const timeout = timeoutSignal(settings.httpTimeoutSeconds);
  let response: Response;

  try {
    response = await fetch(url, {
      ...init,
      signal: timeout.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
      cache: "no-store",
    }).finally(timeout.dispose);
  } catch (error) {
    throw new Error(describeFetchError(error, url));
  }

  if (!response.ok) {
    const message = await response.text();
    throw new HetznerApiError(`Hetzner Cloud API ${response.status}: ${message.slice(0, 240)}`, response.status);
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const hetznerCloudProvider: DnsProviderAdapter = {
  type: ProviderType.HETZNER_CLOUD,
  displayName: "Hetzner Cloud DNS",
  defaultName: "Hetzner Cloud DNS",
  tokenLabel: "Cloud API Token",
  tokenPlaceholder: "Bearer Token aus der Hetzner Console",
  zoneLabel: "Zone ID oder Name",
  zonePlaceholder: "example.com oder 123456",
  recordLabel: "RRSet Name",
  recordPlaceholder: "home oder @",
  async updateRecord({ record, ip, settings }) {
    const rrsetPath =
      `/zones/${encodePathPart(record.zoneId)}/rrsets/${encodePathPart(record.recordName)}/${record.recordType}`;
    let rrset: HetznerRecord | null = null;

    try {
      const response = await hetznerRequest<{ rrset: HetznerRecord }>(record.provider.apiToken, rrsetPath, settings);
      rrset = response.rrset;
    } catch (error) {
      if (!(error instanceof HetznerApiError) || error.status !== 404) throw error;
    }

    if (!rrset) {
      await hetznerRequest(record.provider.apiToken, `/zones/${encodePathPart(record.zoneId)}/rrsets`, settings, {
        method: "POST",
        body: JSON.stringify({
          name: record.recordName,
          type: record.recordType,
          ttl: record.ttl,
          records: [{ value: ip }],
        }),
      });

      return { changed: true, message: `RRSet erstellt: ${ip}` };
    }

    const currentValues = rrset.records.map((item) => item.value);
    const ttlNeedsUpdate = typeof rrset.ttl === "number" && rrset.ttl !== record.ttl;

    if (currentValues.length === 1 && currentValues[0] === ip && !ttlNeedsUpdate) {
      return { changed: false, message: "IP ist bereits aktuell", previousValues: currentValues };
    }

    await hetznerRequest(record.provider.apiToken, `${rrsetPath}/actions/set_records`, settings, {
      method: "POST",
      body: JSON.stringify({ records: [{ value: ip }] }),
    });

    if (ttlNeedsUpdate) {
      await hetznerRequest(record.provider.apiToken, `${rrsetPath}/actions/change_ttl`, settings, {
        method: "POST",
        body: JSON.stringify({ ttl: record.ttl }),
      });
    }

    return {
      changed: true,
      message: `RRSet aktualisiert: ${currentValues.join(", ") || "-"} -> ${ip}`,
      previousValues: currentValues,
    };
  },
};
