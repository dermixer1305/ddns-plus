# DDNS+

DDNS+ is a lightweight self-hosted Dynamic DNS web application built with Next.js App Router, TypeScript, Prisma, and SQLite.

It is designed for homelab and small self-hosted environments where DNS records should be updated automatically when the public IP address changes. Providers, domains, records, and updater settings are managed through the web UI. No `config.json` file is required.

Hetzner Cloud DNS and Cloudflare DNS are tested and working. Additional providers are included through the modular provider system, but they are currently untested and should be verified before production use.

## Features

- Modern dashboard with record status, provider status, public IP state, and logs
- Setup and login system without email addresses
- Multiple domains and subdomains
- Stored DNS zones linked to providers
- IPv4 `A` and IPv6 `AAAA` support
- Automatic public IP detection
- Automatic DNS record updates
- Internal scheduler enabled by default
- Optional `/api/cron` endpoint for external integrations
- Detailed logs and error messages
- Modular provider adapter system
- Hetzner Cloud DNS support
- Cloudflare DNS support
- PowerDNS support
- deSEC support
- DigitalOcean DNS support
- Porkbun DNS support
- DuckDNS support
- Amazon Route 53 support
- Namecheap DNS support
- SQLite via Prisma
- Docker and Docker Compose support
- Responsive dark UI

## Stack

- Next.js App Router
- TypeScript
- Prisma
- SQLite
- Server Actions and API Routes
- Docker

## Quick Start

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run db:push
npm run dev
```

Open `http://localhost:3000` and create the first admin user.

## Environment Variables

```env
SESSION_SECRET="replace-this-with-a-long-random-secret"
PORT=3000
```

Optional:

```env
DDNS_PLUS_SCHEDULER="false"
CRON_SECRET="replace-this-if-you-use-the-cron-endpoint"
```

`DDNS_PLUS_SCHEDULER` only needs to be set if you want to disable the internal scheduler. If the variable is missing, the scheduler is enabled.

`CRON_SECRET` only needs to be set if you want to protect the optional `/api/cron` endpoint.

`PORT` controls the HTTP port used by the Next.js server. The default example uses `3000`.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `SESSION_SECRET` | Yes | none | Secret used for session signing. Use a long random value in production. |
| `PORT` | No | `3000` | HTTP port used by the Next.js server. |
| `DDNS_PLUS_SCHEDULER` | No | enabled | Set to `false` to disable the internal scheduler. |
| `CRON_SECRET` | No | none | Optional Bearer/query secret for the `/api/cron` endpoint. |

SQLite is built in and uses a fixed database path:

```text
data/ddns-plus.db
```

You do not need to configure a database connection string.

## Installation with Docker Compose

Docker Compose is the recommended deployment method for most self-hosted installations.

1. Clone the repository:

```bash
git clone https://github.com/example/ddns-plus.git
cd ddns-plus
```

2. Copy the example environment file:

```bash
cp .env.example .env
```

3. Edit `.env` and set a strong session secret:

```env
SESSION_SECRET="replace-this-with-a-long-random-secret"
PORT=3000
```

4. Start DDNS+:

```bash
docker compose up -d --build
```

5. Open DDNS+:

```text
http://SERVER-IP:3000
```

On first access, create the initial admin user.

The Compose setup starts one service:

- `ddns-plus`: the Next.js application with SQLite data stored in `/app/data/ddns-plus.db`

Docker Compose also uses `PORT` for the host and container port mapping. For example, set `PORT=8080` to serve DDNS+ on `http://localhost:8080`.

Useful commands:

```bash
docker compose logs -f
docker compose restart
docker compose pull
docker compose up -d --build
```

## Installation without Docker on Ubuntu

This guide runs DDNS+ as a normal Node.js application managed by `systemd`.

### 1. Install dependencies

```bash
sudo apt update
sudo apt install -y git curl
```

Install Node.js 24 LTS:

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
```

Check the installed versions:

```bash
node --version
npm --version
```

### 2. Create a service user

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin ddns-plus
```

### 3. Install DDNS+

```bash
sudo mkdir -p /opt/ddns-plus
sudo chown ddns-plus:ddns-plus /opt/ddns-plus
sudo -u ddns-plus git clone https://github.com/example/ddns-plus.git /opt/ddns-plus
cd /opt/ddns-plus
```

Install dependencies and build the app:

```bash
sudo -u ddns-plus npm ci
sudo -u ddns-plus cp .env.example .env
sudo -u ddns-plus nano .env
```

Set at least:

```env
SESSION_SECRET="replace-this-with-a-long-random-secret"
PORT=3000
```

Prepare the database and build:

```bash
sudo -u ddns-plus npm run prisma:generate
sudo -u ddns-plus npm run db:push
sudo -u ddns-plus npm run build
```

The SQLite database is stored here:

```text
/opt/ddns-plus/data/ddns-plus.db
```

### 4. Create the systemd service

Create `/etc/systemd/system/ddns-plus.service`:

```bash
sudo nano /etc/systemd/system/ddns-plus.service
```

Paste:

```ini
[Unit]
Description=DDNS+
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ddns-plus
Group=ddns-plus
WorkingDirectory=/opt/ddns-plus
Environment=NODE_ENV=production
EnvironmentFile=/opt/ddns-plus/.env
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start DDNS+:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ddns-plus
```

Check status and logs:

```bash
sudo systemctl status ddns-plus
sudo journalctl -u ddns-plus -f
```

Open:

```text
http://SERVER-IP:3000
```

### 5. Updating without Docker

```bash
cd /opt/ddns-plus
sudo systemctl stop ddns-plus
sudo -u ddns-plus git pull
sudo -u ddns-plus npm ci
sudo -u ddns-plus npm run prisma:generate
sudo -u ddns-plus npm run db:push
sudo -u ddns-plus npm run build
sudo systemctl start ddns-plus
```

### 6. Reverse proxy and HTTPS

For public access, run DDNS+ behind a reverse proxy with HTTPS, such as Caddy, Nginx, or Traefik.

Example Caddy config:

```caddyfile
ddns.example.com {
  reverse_proxy 127.0.0.1:3000
}
```

## Automatic Updates

DDNS+ starts an internal scheduler inside the Node.js process. A first check is scheduled when the app starts. After that, the scheduler uses the update interval and cooldown configured in the web UI.

The dashboard countdown shows the next real scheduled check. After a check finishes, the dashboard refreshes its server-rendered data automatically.

The optional cron endpoint remains available:

```bash
curl http://localhost:3000/api/cron
```

If `CRON_SECRET` is set, pass it either as a Bearer token or as a query parameter:

```bash
curl -H "Authorization: Bearer replace-this-secret" http://localhost:3000/api/cron
curl "http://localhost:3000/api/cron?secret=replace-this-secret"
```

## Hetzner Cloud DNS

1. Create a Hetzner Cloud API token with DNS permissions for the project that contains your DNS zone.
2. Add a provider in DDNS+ under `Providers`.
3. Add a domain in DDNS+ under `Domains`.
4. Add a DNS record under `DNS Records`.

Example domain:

```text
Domain: example.com
Zone ID or name: example.com
Provider: Hetzner Cloud DNS
```

Example record:

```text
Hostname: home.example.com
Record name: home
Record type: A
TTL: 300
```

DDNS+ uses the Hetzner Cloud DNS API at `https://api.hetzner.cloud/v1`. Missing A/AAAA RRSets are created automatically. Existing RRSets are updated through the provider adapter.

## Cloudflare DNS

1. Create a Cloudflare API token with `Zone DNS Read` and `Zone DNS Edit` permissions for the target zone.
2. Add a provider in DDNS+ under `Providers`.
3. Add a domain in DDNS+ under `Domains`.
4. Add a DNS record under `DNS Records`.

Example domain:

```text
Domain: example.com
Zone ID or name: 00000000000000000000000000000000
Provider: Cloudflare DNS
```

Example record:

```text
Hostname: home.example.com
Record name: home
Record type: A
TTL: 300
```

If the Cloudflare DNS record does not exist, DDNS+ creates it automatically. New Cloudflare records are created with `proxied: false` so DDNS manages the real DNS target IP.

## Additional DNS Providers

DDNS+ also supports these providers:

These provider adapters are included but currently untested. Please verify them with your provider account before relying on them in production.

| Provider | Token field value | Zone value | Record value |
| --- | --- | --- | --- |
| PowerDNS | JSON credentials | Zone ID, usually `example.com.` | Relative name such as `home` or `@` |
| deSEC | API token | Domain such as `example.com` | Subname such as `home` or `@` |
| DigitalOcean DNS | Personal access token | Domain such as `example.com` | Relative name such as `home` or `@` |
| Porkbun DNS | JSON credentials | Domain such as `example.com` | Subdomain such as `home` or empty/root |
| DuckDNS | DuckDNS token | `duckdns.org` | DuckDNS subdomain such as `home` |
| Amazon Route 53 | JSON credentials | Hosted Zone ID such as `Z1234567890ABC` | Full hostname such as `home.example.com` |
| Namecheap DNS | JSON credentials | Domain such as `example.com` | Host name such as `home` or `@` |

JSON credential examples:

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

For Namecheap, add `"sandbox": true` to use the sandbox API.

## Update Settings

`Update interval seconds` defines how often the internal scheduler plans a check.

`Cooldown seconds` prevents the same record from being checked too frequently.

DDNS+ uses the larger value of both settings for the next automatic check:

```text
max(update interval seconds, cooldown seconds)
```

Recommended default:

```text
Update interval seconds: 300
Cooldown seconds: 300
```

## Password Reset

If the password is lost, reset it from the command line:

```bash
npm run password:reset -- admin replace-this-with-a-long-password
```

The new password must be at least 10 characters long.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run prisma:generate
npm run db:push
npm run password:reset -- admin replace-this-with-a-long-password
```

## Provider Development

New DNS providers are implemented as adapters in `lib/providers/` and registered in `lib/providers/registry.ts`.

See [docs/providers.md](docs/providers.md) for details.
