# Contributing

Thanks for helping improve DDNS+.

## Development Setup

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run db:push
npm run dev
```

Before opening a pull request, run:

```bash
npm run lint
npm run build
```

## Pull Requests

- Keep changes focused and easy to review.
- Include screenshots for UI changes.
- Update documentation when behavior, setup, or configuration changes.
- Avoid adding provider-specific secrets, domains, or real IP addresses to examples.
- Use neutral example values such as `example.com`, `home.example.com`, and `replace-this-secret`.

## Provider Contributions

New DNS providers should be added as adapters under `lib/providers/`.

See [docs/providers.md](docs/providers.md) for the expected adapter contract.
