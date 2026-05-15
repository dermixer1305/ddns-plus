import { deleteProviderAction, saveProviderAction } from "@/app/actions";
import { AppShell } from "@/app/app-shell";
import { TextInput } from "@/app/ui";
import { createTranslator } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { listProviderAdapters } from "@/lib/providers/registry";
import { getSettings } from "@/lib/settings";

export default async function ProvidersPage() {
  const [providers, settings] = await Promise.all([
    prisma.dnsProvider.findMany({
      include: { zones: true, records: true },
      orderBy: { createdAt: "asc" },
    }),
    getSettings(),
  ]);
  const t = createTranslator(settings.language);
  const adapters = listProviderAdapters();
  const selectedProvider = adapters[0];

  return (
    <AppShell active="/providers" title={t("providers.title")} eyebrow={t("providers.eyebrow")}>
      <section className="content-grid">
        <div className="panel p-5">
          <p className="eyebrow">{t("providers.newEyebrow")}</p>
          <h2>{t("providers.createTitle")}</h2>
          <form action={saveProviderAction} className="stack mt-5">
            <label className="field">
              <span>{t("common.type")}</span>
              <select name="providerType" defaultValue={selectedProvider.type}>
                {adapters.map((provider) => (
                  <option key={provider.type} value={provider.type}>{provider.displayName}</option>
                ))}
              </select>
            </label>
            <TextInput name="name" label={t("common.name")} placeholder={selectedProvider.defaultName} />
            <TextInput name="apiToken" label={t("providers.apiToken")} type="password" placeholder={t("providers.apiTokenPlaceholder")} required />
            <button className="secondary-button" type="submit">{t("providers.save")}</button>
          </form>
        </div>

        <div className="panel p-5">
          <p className="eyebrow">{t("providers.title")}</p>
          <h2>{t("providers.savedAccounts")}</h2>
          <div className="mini-list">
            {providers.length === 0 ? (
              <p className="empty-state">{t("providers.empty")}</p>
            ) : providers.map((provider) => (
              <div className="mini-row" key={provider.id}>
                <div>
                  <p className="font-medium">{provider.name}</p>
                  <p className="text-xs text-zinc-500">
                    {provider.type} · {provider.zones.length} Domains · {provider.records.length} Records
                  </p>
                  <details className="edit-details compact-edit">
                    <summary>{t("common.edit")}</summary>
                    <form action={saveProviderAction} className="stack mt-3">
                      <input type="hidden" name="id" value={provider.id} />
                      <input type="hidden" name="providerType" value={provider.type} />
                      <TextInput name="name" label={t("common.name")} defaultValue={provider.name} />
                      <TextInput name="apiToken" label={t("providers.apiToken")} type="password" placeholder={t("providers.keepToken")} />
                      <button className="secondary-button" type="submit">{t("common.save")}</button>
                    </form>
                  </details>
                </div>
                <form action={deleteProviderAction}>
                  <input type="hidden" name="id" value={provider.id} />
                  <button className="danger-button small" type="submit">{t("common.delete")}</button>
                </form>
              </div>
            ))}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
