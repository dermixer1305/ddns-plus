import { deleteZoneAction, saveZoneAction } from "@/app/actions";
import { AppShell } from "@/app/app-shell";
import { TextInput } from "@/app/ui";
import { createTranslator } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

export default async function DomainsPage() {
  const [providers, zones, settings] = await Promise.all([
    prisma.dnsProvider.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.dnsZone.findMany({ include: { provider: true, records: true }, orderBy: [{ name: "asc" }] }),
    getSettings(),
  ]);
  const t = createTranslator(settings.language);

  return (
    <AppShell active="/domains" title={t("domains.title")} eyebrow={t("domains.eyebrow")}>
      <section className="content-grid">
        <div className="panel p-5">
          <p className="eyebrow">{t("domains.newEyebrow")}</p>
          <h2>{t("domains.createTitle")}</h2>
          <form action={saveZoneAction} className="form-grid mt-5">
            <label className="field">
              <span>{t("common.provider")}</span>
              <select name="providerId" required disabled={providers.length === 0}>
                <option value="">{providers.length === 0 ? t("records.createProviderFirst") : t("domains.chooseProvider")}</option>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>{provider.name} ({provider.type})</option>
                ))}
              </select>
            </label>
            <TextInput name="name" label={t("common.domain")} placeholder="example.com" required />
            <TextInput name="zoneId" label={t("domains.zoneId")} placeholder={t("domains.zoneIdPlaceholder")} required />
            <button className="secondary-button" type="submit" disabled={providers.length === 0}>{t("domains.save")}</button>
          </form>
          <p className="hint-text">{t("domains.hint")}</p>
        </div>

        <div className="panel p-5">
          <p className="eyebrow">{t("domains.listEyebrow")}</p>
          <h2>{t("domains.savedZones")}</h2>
          <div className="mini-list">
            {zones.length === 0 ? (
              <p className="empty-state">{t("domains.empty")}</p>
            ) : zones.map((zone) => (
              <div className="mini-row" key={zone.id}>
                <div>
                  <p className="font-medium">{zone.name}</p>
                  <p className="text-xs text-zinc-500">
                    {zone.provider.name} · {zone.zoneId} · {zone.records.length} Records
                  </p>
                  <details className="edit-details compact-edit">
                    <summary>{t("common.edit")}</summary>
                    <form action={saveZoneAction} className="stack mt-3">
                      <input type="hidden" name="id" value={zone.id} />
                      <label className="field">
                        <span>{t("common.provider")}</span>
                        <select name="providerId" defaultValue={zone.providerId} required>
                          {providers.map((provider) => (
                            <option key={provider.id} value={provider.id}>{provider.name} ({provider.type})</option>
                          ))}
                        </select>
                      </label>
                      <TextInput name="name" label={t("common.domain")} defaultValue={zone.name} required />
                      <TextInput name="zoneId" label={t("domains.zoneId")} defaultValue={zone.zoneId} required />
                      <button className="secondary-button" type="submit">{t("common.save")}</button>
                    </form>
                  </details>
                </div>
                <form action={deleteZoneAction}>
                  <input type="hidden" name="id" value={zone.id} />
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
