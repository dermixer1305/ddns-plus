import { ProviderType } from "@prisma/client";
import { describeFetchError, timeoutSignal } from "@/lib/http";
import { DnsProviderAdapter } from "@/lib/providers/types";
import { RuntimeSettings } from "@/lib/settings";

type CloudflareDnsRecord = {
  id: string;
  type: "A" | "AAAA";
  name: string;
  content: string;
  ttl: number;
  proxied?: boolean;
};

type CloudflareZone = {
  id: string;
  name: string;
};

type CloudflareResponse<T> = {
  success: boolean;
  result: T;
  errors?: Array<{ code?: number; message?: string }>;
};

async function cloudflareRequest<T>(token: string, path: string, settings: RuntimeSettings, init?: RequestInit) {
  const url = `https://api.cloudflare.com/client/v4${path}`;
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

  const text = await response.text();
  const body = text ? (JSON.parse(text) as CloudflareResponse<T>) : null;

  if (!response.ok || !body?.success) {
    const apiMessage = body?.errors?.map((error) => error.message).filter(Boolean).join(", ");
    throw new Error(`Cloudflare API ${response.status}: ${apiMessage || text.slice(0, 240)}`);
  }

  return body.result;
}

async function findCloudflareRecord(
  token: string,
  zoneId: string,
  type: "A" | "AAAA",
  names: string[],
  settings: RuntimeSettings,
) {
  for (const name of names) {
    const query = new URLSearchParams({
      type,
      name,
      per_page: "1",
    });
    const records = await cloudflareRequest<CloudflareDnsRecord[]>(
      token,
      `/zones/${encodeURIComponent(zoneId)}/dns_records?${query.toString()}`,
      settings,
    );

    if (records[0]) return records[0];
  }

  return null;
}

async function getCloudflareZone(token: string, zoneId: string, settings: RuntimeSettings) {
  return cloudflareRequest<CloudflareZone>(token, `/zones/${encodeURIComponent(zoneId)}`, settings);
}

function uniqueNames(names: string[]) {
  return [...new Set(names.map((name) => name.trim().replace(/\.$/, "")).filter(Boolean))];
}

function buildCloudflareRecordName(recordName: string, zoneName: string) {
  const normalizedRecordName = recordName.trim().replace(/\.$/, "");
  const normalizedZoneName = zoneName.trim().replace(/\.$/, "");

  if (!normalizedRecordName || normalizedRecordName === "@") return normalizedZoneName;
  if (normalizedRecordName === normalizedZoneName || normalizedRecordName.endsWith(`.${normalizedZoneName}`)) {
    return normalizedRecordName;
  }

  return `${normalizedRecordName}.${normalizedZoneName}`;
}

export const cloudflareProvider: DnsProviderAdapter = {
  type: ProviderType.CLOUDFLARE,
  displayName: "Cloudflare DNS",
  defaultName: "Cloudflare DNS",
  tokenLabel: "Cloudflare API Token",
  tokenPlaceholder: "API Token mit Zone DNS Read/Edit",
  zoneLabel: "Zone ID",
  zonePlaceholder: "Cloudflare Zone ID",
  recordLabel: "DNS Record Name",
  recordPlaceholder: "home.example.com",
  async updateRecord({ record, ip, settings }) {
    const recordName = record.recordName.replace(/\.$/, "");
    const zone = await getCloudflareZone(record.provider.apiToken, record.zoneId, settings);
    const writeName = buildCloudflareRecordName(recordName, zone.name);
    const lookupNames = uniqueNames([writeName, recordName]);
    const existingRecord = await findCloudflareRecord(
      record.provider.apiToken,
      record.zoneId,
      record.recordType,
      lookupNames,
      settings,
    );

    if (!existingRecord) {
      await cloudflareRequest<CloudflareDnsRecord>(
        record.provider.apiToken,
        `/zones/${encodeURIComponent(record.zoneId)}/dns_records`,
        settings,
        {
          method: "POST",
          body: JSON.stringify({
            type: record.recordType,
            name: writeName,
            content: ip,
            ttl: record.ttl,
            proxied: false,
          }),
        },
      );

      return { changed: true, message: `DNS Record erstellt: ${ip}` };
    }

    const ttlNeedsUpdate = existingRecord.ttl !== record.ttl;
    if (existingRecord.content === ip && !ttlNeedsUpdate) {
      return { changed: false, message: "IP ist bereits aktuell", previousValues: [existingRecord.content] };
    }

    await cloudflareRequest<CloudflareDnsRecord>(
      record.provider.apiToken,
      `/zones/${encodeURIComponent(record.zoneId)}/dns_records/${encodeURIComponent(existingRecord.id)}`,
      settings,
      {
        method: "PATCH",
        body: JSON.stringify({
          type: record.recordType,
          name: existingRecord.name,
          content: ip,
          ttl: record.ttl,
        }),
      },
    );

    return {
      changed: true,
      message: `DNS Record ${existingRecord.name} aktualisiert: ${existingRecord.content} -> ${ip}`,
      previousValues: [existingRecord.content],
    };
  },
};
