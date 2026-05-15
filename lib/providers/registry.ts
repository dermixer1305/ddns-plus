import { ProviderType } from "@prisma/client";
import { cloudflareProvider } from "@/lib/providers/cloudflare";
import { hetznerCloudProvider } from "@/lib/providers/hetzner-cloud";
import { DnsProviderAdapter } from "@/lib/providers/types";

const providers = [hetznerCloudProvider, cloudflareProvider] satisfies DnsProviderAdapter[];

export function getProviderAdapter(type: ProviderType) {
  const provider = providers.find((item) => item.type === type);
  if (!provider) throw new Error(`Provider ${type} ist nicht registriert`);
  return provider;
}

export function listProviderAdapters() {
  return providers;
}
