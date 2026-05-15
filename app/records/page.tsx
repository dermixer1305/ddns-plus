import { deleteRecordAction, updateRecordAction } from "@/app/actions";
import { AppShell } from "@/app/app-shell";
import { formatDateOrNever, statusClass } from "@/app/ui";
import { createTranslator } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { RecordForm } from "@/app/records/record-form";
import { getSettings } from "@/lib/settings";

export default async function RecordsPage() {
  const [providers, zones, records, settings] = await Promise.all([
    prisma.dnsProvider.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.dnsZone.findMany({ include: { provider: true }, orderBy: [{ name: "asc" }] }),
    prisma.ddnsRecord.findMany({
      include: { provider: true, zoneRef: true },
      orderBy: [{ enabled: "desc" }, { hostname: "asc" }],
    }),
    getSettings(),
  ]);
  const t = createTranslator(settings.language);
  const formTexts = {
    save: t("records.save"),
    savedDomain: t("records.savedDomain"),
    manualZone: t("records.manualZone"),
    zone: t("common.zone"),
    zoneId: t("records.zoneId"),
    zoneIdPlaceholder: t("records.zoneIdPlaceholder"),
    recordName: t("records.recordName"),
    recordNamePlaceholder: t("records.recordNamePlaceholder"),
    type: t("common.type"),
    provider: t("common.provider"),
    hostname: t("common.hostname"),
    createProviderFirst: t("records.createProviderFirst"),
    chooseProviderManual: t("records.chooseProviderManual"),
    active: t("records.active"),
  };
  const providerOptions = providers.map((provider) => ({
    id: provider.id,
    name: provider.name,
    type: provider.type,
  }));
  const zoneOptions = zones.map((zone) => ({
    id: zone.id,
    name: zone.name,
    zoneId: zone.zoneId,
    providerId: zone.providerId,
    providerName: zone.provider.name,
  }));

  return (
    <AppShell active="/records" title={t("records.title")} eyebrow={t("records.eyebrow")}>
      <div className="dashboard-stack">
        <section className="panel p-5">
          <div className="section-head">
            <div>
              <p className="eyebrow">{t("records.newEyebrow")}</p>
              <h2>{t("records.createTitle")}</h2>
            </div>
          </div>
          <RecordForm providers={providerOptions} zones={zoneOptions} texts={formTexts} />
          <p className="hint-text">{t("records.domainHint")}</p>
        </section>

      <section className="panel p-5">
        <p className="eyebrow">{t("records.listEyebrow")}</p>
          <h2>{t("records.existingTitle")}</h2>
        <div className="record-list">
          {records.length === 0 ? (
            <p className="empty-state">{t("dashboard.noRecords")}</p>
          ) : records.map((record) => (
            <article className="record-row" key={record.id}>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3>{record.hostname}</h3>
                  <span className={`status-pill ${statusClass(record.lastStatus)}`}>{record.lastStatus}</span>
                  <span className="type-pill">{record.recordType}</span>
                </div>
                <p className="mt-2 text-sm text-zinc-400">
                  {record.provider.name} · {record.zoneRef?.name || record.zoneId} · {record.recordName}
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  {t("common.lastIp")}: {record.lastIp || "-"} · {t("common.check")}: {formatDateOrNever(record.lastCheckedAt, t, settings.language)}
                </p>
                {record.lastMessage ? <p className="mt-2 text-sm text-zinc-300">{record.lastMessage}</p> : null}
                <details className="edit-details">
                  <summary>{t("common.edit")}</summary>
                  <RecordForm
                    providers={providerOptions}
                    zones={zoneOptions}
                    texts={formTexts}
                    submitLabel={t("records.saveChanges")}
                    defaults={{
                      id: record.id,
                      hostname: record.hostname,
                      zoneRefId: record.zoneRefId,
                      zoneId: record.zoneId,
                      recordName: record.recordName,
                      recordType: record.recordType,
                      providerId: record.providerId,
                      ttl: record.ttl,
                      enabled: record.enabled,
                    }}
                  />
                </details>
              </div>
              <div className="row-actions">
                <form action={updateRecordAction}>
                  <input type="hidden" name="id" value={record.id} />
                  <button className="ghost-button" type="submit">{t("common.update")}</button>
                </form>
                <form action={deleteRecordAction}>
                  <input type="hidden" name="id" value={record.id} />
                  <button className="danger-button" type="submit">{t("common.delete")}</button>
                </form>
              </div>
            </article>
          ))}
        </div>
      </section>
      </div>
    </AppShell>
  );
}
