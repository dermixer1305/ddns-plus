import { ProviderType } from "@prisma/client";
import { cloudflareProvider } from "@/lib/providers/cloudflare";
import { desecProvider } from "@/lib/providers/desec";
import { digitalOceanProvider } from "@/lib/providers/digitalocean";
import { duckDnsProvider } from "@/lib/providers/duckdns";
import { hetznerCloudProvider } from "@/lib/providers/hetzner-cloud";
import { namecheapProvider } from "@/lib/providers/namecheap";
import { porkbunProvider } from "@/lib/providers/porkbun";
import { powerDnsProvider } from "@/lib/providers/powerdns";
import { route53Provider } from "@/lib/providers/route53";
import { DnsProviderAdapter } from "@/lib/providers/types";

const providers = [
  hetznerCloudProvider,
  cloudflareProvider,
  powerDnsProvider,
  desecProvider,
  digitalOceanProvider,
  porkbunProvider,
  duckDnsProvider,
  route53Provider,
  namecheapProvider,
] satisfies DnsProviderAdapter[];

export function getProviderAdapter(type: ProviderType) {
  const provider = providers.find((item) => item.type === type);
  if (!provider) throw new Error(`Provider ${type} is not registered`);
  return provider;
}

export function listProviderAdapters() {
  return providers;
}
