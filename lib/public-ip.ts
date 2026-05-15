import { IpProvider, RecordType } from "@prisma/client";
import { describeFetchError } from "@/lib/http";
import { RuntimeSettings } from "@/lib/settings";
import { timeoutSignal } from "@/lib/http";

const ipv4ProviderUrls: Record<IpProvider, string> = {
  IPIFY: "https://api.ipify.org?format=json",
  ICANHAZIP: "https://ipv4.icanhazip.com",
  IDENT: "https://v4.ident.me",
  SEEIP: "https://ipv4.seeip.org",
};

const ipv6ProviderUrls: Record<IpProvider, string> = {
  IPIFY: "https://api6.ipify.org?format=json",
  ICANHAZIP: "https://ipv6.icanhazip.com",
  IDENT: "https://v6.ident.me",
  SEEIP: "https://ipv6.seeip.org",
};

function isIpForType(type: RecordType, value: string) {
  return type === "A" ? value.includes(".") && !value.includes(":") : value.includes(":");
}

export async function detectPublicIp(type: RecordType, settings: RuntimeSettings) {
  const provider = type === "A" ? settings.ipv4Provider : settings.ipv6Provider;
  const providerUrls = type === "A" ? ipv4ProviderUrls : ipv6ProviderUrls;
  const fallbackProviders = [
    provider,
    ...Object.keys(providerUrls).filter((item) => item !== provider),
  ] as IpProvider[];
  const errors: string[] = [];

  for (const fallbackProvider of fallbackProviders) {
    try {
      return await detectPublicIpWithProvider(type, fallbackProvider, providerUrls[fallbackProvider], settings);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new Error(`IP-Erkennung fehlgeschlagen: ${errors.join(" | ")}`);
}

export async function getPublicIpOverview(settings: RuntimeSettings) {
  const [ipv4, ipv6] = await Promise.all([
    detectPublicIp("A", settings)
      .then((ip) => ({ ip, error: null }))
      .catch((error) => ({ ip: null, error: error instanceof Error ? error.message : "IPv4-Erkennung fehlgeschlagen" })),
    detectPublicIp("AAAA", settings)
      .then((ip) => ({ ip, error: null }))
      .catch((error) => ({ ip: null, error: error instanceof Error ? error.message : "IPv6-Erkennung fehlgeschlagen" })),
  ]);

  return { ipv4, ipv6 };
}

async function detectPublicIpWithProvider(
  type: RecordType,
  provider: IpProvider,
  url: string,
  settings: RuntimeSettings,
) {
  const timeout = timeoutSignal(settings.httpTimeoutSeconds);
  let response: Response;

  try {
    response = await fetch(url, { cache: "no-store", signal: timeout.signal }).finally(timeout.dispose);
  } catch (error) {
    throw new Error(`${provider}: ${describeFetchError(error, url)}`);
  }

  if (!response.ok) {
    throw new Error(`${provider}: IP-Erkennung fehlgeschlagen (${response.status})`);
  }

  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? ((await response.json()) as { ip?: string }).ip || ""
    : await response.text();
  const ip = body.trim();

  if (!ip || !isIpForType(type, ip)) {
    throw new Error(`${provider}: Keine gültige ${type === "A" ? "IPv4" : "IPv6"} erkannt`);
  }

  return ip;
}
