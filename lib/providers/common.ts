import { describeFetchError, timeoutSignal } from "@/lib/http";
import { RuntimeSettings } from "@/lib/settings";

export function ensureTrailingDot(pValue: string) {
  const lValue = pValue.trim();
  return lValue.endsWith(".") ? lValue : `${lValue}.`;
}

export function stripTrailingDot(pValue: string) {
  return pValue.trim().replace(/\.$/, "");
}

export function buildFqdn(pRecordName: string, pZoneName: string) {
  const lRecordName = stripTrailingDot(pRecordName);
  const lZoneName = stripTrailingDot(pZoneName);

  if (!lRecordName || lRecordName === "@") return lZoneName;
  if (lRecordName === lZoneName || lRecordName.endsWith(`.${lZoneName}`)) return lRecordName;
  return `${lRecordName}.${lZoneName}`;
}

export function relativeRecordName(pRecordName: string, pZoneName: string) {
  const lRecordName = stripTrailingDot(pRecordName);
  const lZoneName = stripTrailingDot(pZoneName);

  if (!lRecordName || lRecordName === "@" || lRecordName === lZoneName) return "@";
  if (lRecordName.endsWith(`.${lZoneName}`)) return lRecordName.slice(0, -lZoneName.length - 1) || "@";
  return lRecordName;
}

export function parseJsonCredentials<T>(pRawValue: string, pProviderName: string): T {
  try {
    return JSON.parse(pRawValue) as T;
  } catch {
    throw new Error(`${pProviderName} credentials must be valid JSON`);
  }
}

export async function readJsonResponse<T>(pResponse: Response, pUrl: string, pProviderName: string) {
  const lText = await pResponse.text();
  const lBody = lText ? (JSON.parse(lText) as T) : null;

  if (!pResponse.ok) {
    const lMessage = typeof lBody === "object" && lBody && "message" in lBody
      ? String((lBody as { message?: unknown }).message)
      : lText.slice(0, 240);
    throw new Error(`${pProviderName} API ${pResponse.status}: ${lMessage || pUrl}`);
  }

  return lBody as T;
}

export async function fetchWithTimeout(pUrl: string, pSettings: RuntimeSettings, pInit?: RequestInit) {
  const lTimeout = timeoutSignal(pSettings.httpTimeoutSeconds);

  try {
    return await fetch(pUrl, {
      ...pInit,
      signal: lTimeout.signal,
      cache: "no-store",
    }).finally(lTimeout.dispose);
  } catch (pError) {
    throw new Error(describeFetchError(pError, pUrl));
  }
}
