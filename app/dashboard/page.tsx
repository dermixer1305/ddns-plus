import Link from "next/link";
import { runAllUpdatesAction } from "@/app/actions";
import { AppShell } from "@/app/app-shell";
import { CurrentIpCards } from "@/app/current-ip-card";
import { RefreshCountdown } from "@/app/refresh-countdown";
import { formatDate, getNextRefresh, Stat, statusClass } from "@/app/ui";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

export default async function DashboardPage() {
  const [providers, zones, records, recentRecords, logs, settings] = await Promise.all([
    prisma.dnsProvider.count(),
    prisma.dnsZone.count(),
    prisma.ddnsRecord.findMany({
      include: { provider: true, zoneRef: true },
      orderBy: [{ enabled: "desc" }, { hostname: "asc" }],
    }),
    prisma.ddnsRecord.findMany({
      include: { provider: true, zoneRef: true },
      orderBy: [{ enabled: "desc" }, { hostname: "asc" }],
      take: 8,
    }),
    prisma.updateLog.findMany({
      include: { record: { include: { provider: true } } },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    getSettings(),
  ]);
  const activeRecords = records.filter((record) => record.enabled).length;
  const errorRecords = records.filter((record) => record.lastStatus === "ERROR").length;
  const refreshIntervalSeconds = Math.max(settings.updatePeriodSeconds, settings.cooldownSeconds);
  const nextRefresh = getNextRefresh(records, refreshIntervalSeconds);

  return (
    <AppShell
      active="/dashboard"
      title="Dynamic DNS Dashboard"
      action={
        <form action={runAllUpdatesAction}>
          <button className="primary-button" type="submit">Alle aktualisieren</button>
        </form>
      }
    >
      <section className="stats-grid">
        <Stat label="Aktive Records" value={activeRecords} />
        <Stat label="Provider" value={providers} />
        <Stat label="Domains" value={zones} tone="text-sky-300" />
        <Stat label="Intervall" value={`${Math.round(settings.updatePeriodSeconds / 60)}m`} />
        <Stat label="Fehler" value={errorRecords} tone={errorRecords ? "text-rose-300" : "text-emerald-300"} />
      </section>
      <RefreshCountdown
        nextRefreshAt={nextRefresh?.toISOString() || null}
        intervalSeconds={refreshIntervalSeconds}
        lastUpdateFinishedAt={settings.lastUpdateFinishedAt?.toISOString() || null}
        lastUpdateStatus={settings.lastUpdateStatus}
      />
      <CurrentIpCards />
      <section className="content-grid">
        <div className="panel p-5">
          <div className="section-head">
            <div>
              <p className="eyebrow">Records</p>
              <h2>Letzte DNS Einträge</h2>
            </div>
            <Link className="ghost-link" href="/records">Alle anzeigen</Link>
          </div>
          <div className="record-list">
            {records.length === 0 ? (
              <p className="empty-state">Noch keine Records angelegt.</p>
            ) : recentRecords.map((record) => (
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
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="panel p-5">
          <div className="section-head">
            <div>
              <p className="eyebrow">Logs</p>
              <h2>Letzte Ereignisse</h2>
            </div>
            <Link className="ghost-link" href="/logs">Alle Logs</Link>
          </div>
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
              </details>
            ))}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
