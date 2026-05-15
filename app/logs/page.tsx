import { AppShell } from "@/app/app-shell";
import { formatDate } from "@/app/ui";
import { prisma } from "@/lib/prisma";

export default async function LogsPage() {
  const logs = await prisma.updateLog.findMany({
    include: { record: { include: { provider: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <AppShell active="/logs" title="Logs" eyebrow="Update Ereignisse">
      <section className="panel p-5">
        <p className="eyebrow">Logs</p>
        <h2>Letzte Ereignisse</h2>
        <div className="log-list">
          {logs.length === 0 ? (
            <p className="empty-state">Noch keine Logs vorhanden.</p>
          ) : logs.map((log) => (
            <details className="log-row" key={log.id}>
              <summary>
                <span className={`log-dot ${log.level.toLowerCase()}`} />
                <span>
                  <span className="log-message">{log.message}</span>
                  <span className="log-meta">{log.record?.hostname || "System"} · {formatDate(log.createdAt)}</span>
                </span>
              </summary>
              <dl className="log-details">
                <div>
                  <dt>Level</dt>
                  <dd>{log.level}</dd>
                </div>
                <div>
                  <dt>Provider</dt>
                  <dd>{log.record?.provider.name || "-"}</dd>
                </div>
                <div>
                  <dt>Provider-Typ</dt>
                  <dd>{log.record?.provider.type || "-"}</dd>
                </div>
                <div>
                  <dt>Hostname</dt>
                  <dd>{log.record?.hostname || "-"}</dd>
                </div>
                <div>
                  <dt>Zone</dt>
                  <dd>{log.record?.zoneId || "-"}</dd>
                </div>
                <div>
                  <dt>Record</dt>
                  <dd>{log.record ? `${log.record.recordName} (${log.record.recordType})` : "-"}</dd>
                </div>
                <div>
                  <dt>IP</dt>
                  <dd>{log.ip || "-"}</dd>
                </div>
                <div className="wide">
                  <dt>Meldung</dt>
                  <dd>{log.message}</dd>
                </div>
              </dl>
            </details>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
