import { deleteProviderAction, saveProviderAction } from "@/app/actions";
import { AppShell } from "@/app/app-shell";
import { TextInput } from "@/app/ui";
import { prisma } from "@/lib/prisma";
import { listProviderAdapters } from "@/lib/providers/registry";

export default async function ProvidersPage() {
  const providers = await prisma.dnsProvider.findMany({
    include: { zones: true, records: true },
    orderBy: { createdAt: "asc" },
  });
  const adapters = listProviderAdapters();
  const selectedProvider = adapters[0];

  return (
    <AppShell active="/providers" title="Provider" eyebrow="DNS Accounts">
      <section className="content-grid">
        <div className="panel p-5">
          <p className="eyebrow">Neuer Provider</p>
          <h2>DNS Account speichern</h2>
          <form action={saveProviderAction} className="stack mt-5">
            <label className="field">
              <span>Typ</span>
              <select name="providerType" defaultValue={selectedProvider.type}>
                {adapters.map((provider) => (
                  <option key={provider.type} value={provider.type}>{provider.displayName}</option>
                ))}
              </select>
            </label>
            <TextInput name="name" label="Name" placeholder={selectedProvider.defaultName} />
            <TextInput name="apiToken" label="API Token" type="password" placeholder="Provider API Token" required />
            <button className="secondary-button" type="submit">Provider speichern</button>
          </form>
        </div>

        <div className="panel p-5">
          <p className="eyebrow">Provider</p>
          <h2>Gespeicherte Accounts</h2>
          <div className="mini-list">
            {providers.length === 0 ? (
              <p className="empty-state">Noch kein Provider gespeichert.</p>
            ) : providers.map((provider) => (
              <div className="mini-row" key={provider.id}>
                <div>
                  <p className="font-medium">{provider.name}</p>
                  <p className="text-xs text-zinc-500">
                    {provider.type} · {provider.zones.length} Domains · {provider.records.length} Records
                  </p>
                  <details className="edit-details compact-edit">
                    <summary>Bearbeiten</summary>
                    <form action={saveProviderAction} className="stack mt-3">
                      <input type="hidden" name="id" value={provider.id} />
                      <input type="hidden" name="providerType" value={provider.type} />
                      <TextInput name="name" label="Name" defaultValue={provider.name} />
                      <TextInput name="apiToken" label="API Token" type="password" placeholder="Leer lassen, um Token zu behalten" />
                      <button className="secondary-button" type="submit">Speichern</button>
                    </form>
                  </details>
                </div>
                <form action={deleteProviderAction}>
                  <input type="hidden" name="id" value={provider.id} />
                  <button className="danger-button small" type="submit">Löschen</button>
                </form>
              </div>
            ))}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
