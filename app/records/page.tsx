import { deleteRecordAction, updateRecordAction } from "@/app/actions";
import { AppShell } from "@/app/app-shell";
import { formatDate, statusClass } from "@/app/ui";
import { prisma } from "@/lib/prisma";
import { RecordForm } from "@/app/records/record-form";

export default async function RecordsPage() {
  const [providers, zones, records] = await Promise.all([
    prisma.dnsProvider.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.dnsZone.findMany({ include: { provider: true }, orderBy: [{ name: "asc" }] }),
    prisma.ddnsRecord.findMany({
      include: { provider: true, zoneRef: true },
      orderBy: [{ enabled: "desc" }, { hostname: "asc" }],
    }),
  ]);
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
    <AppShell active="/records" title="DNS Records" eyebrow="Domains & Subdomains">
      <section className="panel p-5">
        <div className="section-head">
          <div>
            <p className="eyebrow">Neuer Record</p>
            <h2>DNS Eintrag anlegen</h2>
          </div>
        </div>
        <RecordForm providers={providerOptions} zones={zoneOptions} />
        <p className="hint-text">
          Wenn du eine gespeicherte Domain wählst, werden Provider und Zone-ID automatisch aus der Domain übernommen.
        </p>
      </section>

      <section className="panel p-5 mt-4">
        <p className="eyebrow">Records</p>
          <h2>Bestehende Einträge</h2>
        <div className="record-list">
          {records.length === 0 ? (
            <p className="empty-state">Noch keine Records angelegt.</p>
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
                  Letzte IP: {record.lastIp || "-"} · Check: {formatDate(record.lastCheckedAt)}
                </p>
                {record.lastMessage ? <p className="mt-2 text-sm text-zinc-300">{record.lastMessage}</p> : null}
                <details className="edit-details">
                  <summary>Bearbeiten</summary>
                  <RecordForm
                    providers={providerOptions}
                    zones={zoneOptions}
                    submitLabel="Änderungen speichern"
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
                  <button className="ghost-button" type="submit">Update</button>
                </form>
                <form action={deleteRecordAction}>
                  <input type="hidden" name="id" value={record.id} />
                  <button className="danger-button" type="submit">Löschen</button>
                </form>
              </div>
            </article>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
