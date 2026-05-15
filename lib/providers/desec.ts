import { ProviderType } from "@prisma/client";
import { fetchWithTimeout, readJsonResponse, relativeRecordName } from "@/lib/providers/common";
import { DnsProviderAdapter } from "@/lib/providers/types";
import { RuntimeSettings } from "@/lib/settings";

type DesecRrset = {
  records: string[];
  ttl: number;
};

class DesecApiError extends Error {
  constructor(
    pMessage: string,
    readonly status: number,
  ) {
    super(pMessage);
  }
}

async function desecRequest<T>(pToken: string, pPath: string, pSettings: RuntimeSettings, pInit?: RequestInit) {
  const lUrl = `https://desec.io/api/v1${pPath}`;
  const lResponse = await fetchWithTimeout(lUrl, pSettings, {
    ...pInit,
    headers: {
      Authorization: `Token ${pToken}`,
      "Content-Type": "application/json",
      ...(pInit?.headers || {}),
    },
  });

  if (lResponse.status === 204) return undefined as T;

  try {
    return await readJsonResponse<T>(lResponse, lUrl, "deSEC");
  } catch (pError) {
    if (!lResponse.ok) {
      throw new DesecApiError(pError instanceof Error ? pError.message : "deSEC request failed", lResponse.status);
    }
    throw pError;
  }
}

export const desecProvider: DnsProviderAdapter = {
  type: ProviderType.DESEC,
  displayName: "deSEC DNS",
  defaultName: "deSEC DNS",
  tokenLabel: "deSEC API Token",
  tokenPlaceholder: "Token",
  zoneLabel: "Domain",
  zonePlaceholder: "example.com",
  recordLabel: "Subname",
  recordPlaceholder: "home or @",
  async updateRecord({ record, ip, settings }) {
    const lDomain = record.zoneId;
    const lSubname = relativeRecordName(record.recordName, lDomain);
    const lPath =
      `/domains/${encodeURIComponent(lDomain)}/rrsets/${encodeURIComponent(lSubname)}/${record.recordType}/`;
    let lExisting: DesecRrset | null = null;

    try {
      lExisting = await desecRequest<DesecRrset>(record.provider.apiToken, lPath, settings);
    } catch (pError) {
      if (!(pError instanceof DesecApiError) || pError.status !== 404) throw pError;
    }

    if (lExisting && lExisting.records.length === 1 && lExisting.records[0] === ip && lExisting.ttl === record.ttl) {
      return { changed: false, message: "IP is already current", previousValues: lExisting.records };
    }

    await desecRequest(record.provider.apiToken, lPath, settings, {
      method: "PUT",
      body: JSON.stringify({
        subname: lSubname === "@" ? "" : lSubname,
        type: record.recordType,
        ttl: record.ttl,
        records: [ip],
      }),
    });

    return {
      changed: true,
      message: lExisting ? `RRset updated: ${lExisting.records.join(", ") || "-"} -> ${ip}` : `RRset created: ${ip}`,
      previousValues: lExisting?.records,
    };
  },
};
