# DNS Provider Development

DDNS+ separates the generic updater logic from provider-specific DNS API calls.

Provider adapters are intentionally small. A new provider only needs to expose metadata for the UI and implement the `updateRecord` function.

## Structure

- `lib/ddns.ts`: orchestration, cooldown handling, public IP detection, status updates, and logging
- `lib/providers/types.ts`: provider adapter interface
- `lib/providers/registry.ts`: registered provider adapters
- `lib/providers/hetzner-cloud.ts`: Hetzner Cloud DNS adapter
- `lib/providers/cloudflare.ts`: Cloudflare DNS adapter
- `lib/providers/powerdns.ts`: PowerDNS adapter
- `lib/providers/desec.ts`: deSEC adapter
- `lib/providers/digitalocean.ts`: DigitalOcean DNS adapter
- `lib/providers/porkbun.ts`: Porkbun DNS adapter
- `lib/providers/duckdns.ts`: DuckDNS adapter
- `lib/providers/route53.ts`: Amazon Route 53 adapter
- `lib/providers/namecheap.ts`: Namecheap DNS adapter

## Add a Provider

1. Extend the Prisma enum in `prisma/schema.prisma`:

```prisma
enum ProviderType {
  HETZNER_CLOUD
  CLOUDFLARE
  EXAMPLE_PROVIDER
}
```

2. Create an adapter file, for example `lib/providers/example-provider.ts`:

```ts
import { ProviderType } from "@prisma/client";
import { DnsProviderAdapter } from "@/lib/providers/types";

export const exampleProvider: DnsProviderAdapter = {
  type: ProviderType.EXAMPLE_PROVIDER,
  displayName: "Example DNS",
  defaultName: "Example DNS",
  tokenLabel: "API token",
  tokenPlaceholder: "example-api-token",
  zoneLabel: "Zone",
  zonePlaceholder: "example.com",
  recordLabel: "Record",
  recordPlaceholder: "home",
  async updateRecord({ record, ip, settings }) {
    // Call the provider API and set the A/AAAA record to `ip`.
    // Use settings.httpTimeoutSeconds for HTTP timeouts.
    return {
      changed: true,
      message: `Record updated: ${ip}`,
    };
  },
};
```

3. Register the adapter in `lib/providers/registry.ts`:

```ts
const providers = [hetznerCloudProvider, cloudflareProvider, exampleProvider] satisfies DnsProviderAdapter[];
```

4. Update Prisma:

```bash
npm run prisma:generate
npm run db:push
```

## Adapter Contract

`updateRecord` receives:

- `record`: the DDNS+ record including provider data and token
- `ip`: the detected public IPv4 or IPv6 address
- `settings`: global runtime settings

`updateRecord` returns:

- `changed: false` if no DNS update was required
- `changed: true` if a record was created or updated
- `message`: the status message shown in logs and in the UI

The generic updater engine handles status updates, logs, `lastIp`, and timestamps.

## Recommended Behavior

Provider adapters should:

- look up an existing DNS record first
- update the existing record if it exists and the IP changed
- create the record if it does not exist
- return `changed: false` if the record already points to the detected IP
- throw an `Error` with a useful message if the provider API rejects the request

## Example Values

Use neutral examples in docs, tests, and placeholders:

```text
Domain: example.com
Hostname: home.example.com
Record name: home
Zone ID: 00000000000000000000000000000000
API token: example-api-token
```

## Existing Provider Notes

Some providers use a single API token string, while others need multiple credential fields. DDNS+ stores provider credentials in one encrypted-at-rest-ready text field today, so multi-field providers use JSON in the token field.

Examples:

```json
{"apiUrl":"https://pdns.example.com/api/v1","apiKey":"replace-this-secret","serverId":"localhost"}
```

```json
{"apikey":"pk1_replace_this","secretapikey":"sk1_replace_this"}
```

```json
{"accessKeyId":"AKIA_REPLACE_THIS","secretAccessKey":"replace-this-secret"}
```

```json
{"apiUser":"example-user","apiKey":"replace-this-key","clientIp":"203.0.113.10"}
```

Provider adapters should not log full credential values.
