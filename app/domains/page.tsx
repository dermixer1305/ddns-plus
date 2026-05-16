import { deleteZoneAction, saveZoneAction } from "@/app/actions";
import { AppShell } from "@/app/app-shell";
import { TextInput } from "@/app/ui";
import { prisma } from "@/lib/prisma";

export default async function DomainsPage() {
  const [providers, zones] = await Promise.all([
    prisma.dnsProvider.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.dnsZone.findMany({ include: { provider: true, records: true }, orderBy: [{ name: "asc" }] }),
  ]);

  return (
    <AppShell active="/domains" title="Domains" eyebrow="Provider domains and zone IDs">
      <section className="content-grid">
        <div className="panel p-5">
          <p className="eyebrow">New domain</p>
          <h2>Link domain to provider</h2>
          <form action={saveZoneAction} className="form-grid mt-5">
            <label className="field">
              <span>Provider</span>
              <select name="providerId" required disabled={providers.length === 0}>
                <option value="">{providers.length === 0 ? "Create a provider first" : "Choose provider"}</option>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>{provider.name} ({provider.type})</option>
                ))}
              </select>
            </label>
            <TextInput name="name" label="Domain" placeholder="example.com" required />
            <TextInput name="zoneId" label="Zone ID or name" placeholder="Cloudflare Zone ID or Hetzner zone" required />
            <button className="secondary-button" type="submit" disabled={providers.length === 0}>Save domain</button>
          </form>
          <p className="hint-text">A provider can have any number of domains/zones.</p>
        </div>

        <div className="panel p-5">
          <p className="eyebrow">Domains</p>
          <h2>Stored zones</h2>
          <div className="mini-list">
            {zones.length === 0 ? (
              <p className="empty-state">No domain saved yet.</p>
            ) : zones.map((zone) => (
              <div className="mini-row" key={zone.id}>
                <div>
                  <p className="font-medium">{zone.name}</p>
                  <p className="text-xs text-zinc-500">
                    {zone.provider.name} · {zone.zoneId} · {zone.records.length} Records
                  </p>
                  <details className="edit-details compact-edit">
                    <summary>Edit</summary>
                    <form action={saveZoneAction} className="stack mt-3">
                      <input type="hidden" name="id" value={zone.id} />
                      <label className="field">
                        <span>Provider</span>
                        <select name="providerId" defaultValue={zone.providerId} required>
                          {providers.map((provider) => (
                            <option key={provider.id} value={provider.id}>{provider.name} ({provider.type})</option>
                          ))}
                        </select>
                      </label>
                      <TextInput name="name" label="Domain" defaultValue={zone.name} required />
                      <TextInput name="zoneId" label="Zone ID or name" defaultValue={zone.zoneId} required />
                      <button className="secondary-button" type="submit">Save</button>
                    </form>
                  </details>
                </div>
                <form action={deleteZoneAction}>
                  <input type="hidden" name="id" value={zone.id} />
                  <button className="danger-button small" type="submit">Delete</button>
                </form>
              </div>
            ))}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
