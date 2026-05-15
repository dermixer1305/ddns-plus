# Security Policy

DDNS+ stores DNS provider API tokens locally in its configured database. Treat the database file and backups as sensitive data.

## Supported Versions

Security fixes are handled for the latest released version.

## Reporting a Vulnerability

Please do not open a public issue for security vulnerabilities.

Report suspected vulnerabilities privately through GitHub Security Advisories if available for the repository. If advisories are not enabled, contact the project maintainer privately.

Include:

- affected version or commit
- clear reproduction steps
- impact description
- relevant logs with secrets removed

## Deployment Recommendations

- Use a strong `SESSION_SECRET`.
- Run DDNS+ behind HTTPS when exposed outside a private network.
- Limit access to the web UI with a reverse proxy, VPN, or firewall when possible.
- Use provider API tokens with the minimum required permissions.
- Keep SQLite database files and backups private.
- Do not share logs that contain provider tokens, real domains, or public IP addresses.
