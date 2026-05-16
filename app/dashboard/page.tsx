import Link from "next/link";
import { runAllUpdatesAction } from "@/app/actions";
import { AppShell } from "@/app/app-shell";
import { CurrentIpCards } from "@/app/current-ip-card";
import { RefreshCountdown } from "@/app/refresh-countdown";
import { formatDateOrNever, getNextRefresh, Stat, statusClass } from "@/app/ui";
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
  const ipTexts = {
    publicIpv4: "Public IPv4",
    publicIpv6: "Public IPv6",
    notNeeded: "Not needed",
    notDetected: "Not detected",
    notChecked: "Not checked yet",
    lastCheck: "Last check: {date}",
    ipv4Unused: "Not needed while no active A record exists",
    ipv6Unused: "Not needed while no active AAAA record exists",
    detectFailed: "IP detection failed",
    locale: "en",
  };
  const countdownTexts = {
    noActiveRecords: "No active records",
    automaticCheck: "Automatic check",
    running: "running...",
    waiting: "waiting...",
    ariaUntil: "Time until the next automatic check",
    ariaRunning: "Automatic check is running",
  };

  return (
    <AppShell
      active="/dashboard"
      title="Dynamic DNS Dashboard"
      action={
        <form action={runAllUpdatesAction}>
          <button className="primary-button" type="submit">Update all</button>
        </form>
      }
    >
      <div className="dashboard-stack">
        <section className="stats-grid">
          <Stat label="Active records" value={activeRecords} />
          <Stat label="Providers" value={providers} />
          <Stat label="Domains" value={zones} tone="text-sky-300" />
          <Stat label="Interval" value={`${Math.round(settings.updatePeriodSeconds / 60)}m`} />
          <Stat label="Errors" value={errorRecords} tone={errorRecords ? "text-rose-300" : "text-emerald-300"} />
        </section>
        <RefreshCountdown
          nextRefreshAt={nextRefresh?.toISOString() || null}
          intervalSeconds={refreshIntervalSeconds}
          lastUpdateFinishedAt={settings.lastUpdateFinishedAt?.toISOString() || null}
          lastUpdateStatus={settings.lastUpdateStatus}
          texts={countdownTexts}
        />
        <CurrentIpCards texts={ipTexts} />
        <section className="content-grid">
          <div className="panel p-5">
            <div className="section-head">
              <div>
                <p className="eyebrow">Records</p>
                <h2>Recent DNS records</h2>
              </div>
              <Link className="ghost-link" href="/records">Show all</Link>
            </div>
            <div className="record-list">
              {records.length === 0 ? (
                <p className="empty-state">No records created yet.</p>
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
                      Last IP: {record.lastIp || "-"} · Check: {formatDateOrNever(record.lastCheckedAt)}
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
                <h2>Recent events</h2>
              </div>
              <Link className="ghost-link" href="/logs">All logs</Link>
            </div>
            <div className="log-list">
              {logs.length === 0 ? (
                <p className="empty-state">No logs yet.</p>
              ) : logs.map((log) => (
                <details className="log-row" key={log.id}>
                  <summary>
                    <span className={`log-dot ${log.level.toLowerCase()}`} />
                    <span>
                      <span className="log-message">{log.message}</span>
                      <span className="log-meta">{log.record?.hostname || "System"} · {formatDateOrNever(log.createdAt)}</span>
                    </span>
                  </summary>
                </details>
              ))}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
