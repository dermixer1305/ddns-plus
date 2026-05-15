import Link from "next/link";
import { runAllUpdatesAction } from "@/app/actions";
import { AppShell } from "@/app/app-shell";
import { CurrentIpCards } from "@/app/current-ip-card";
import { RefreshCountdown } from "@/app/refresh-countdown";
import { formatDateOrNever, getNextRefresh, Stat, statusClass } from "@/app/ui";
import { createTranslator } from "@/lib/i18n";
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
  const t = createTranslator(settings.language);
  const ipTexts = {
    publicIpv4: t("ip.publicIpv4"),
    publicIpv6: t("ip.publicIpv6"),
    notNeeded: t("ip.notNeeded"),
    notDetected: t("ip.notDetected"),
    notChecked: t("ip.notChecked"),
    lastCheck: t("ip.lastCheck"),
    ipv4Unused: t("ip.ipv4Unused"),
    ipv6Unused: t("ip.ipv6Unused"),
    detectFailed: t("ip.detectFailed"),
    locale: settings.language,
  };
  const countdownTexts = {
    noActiveRecords: t("countdown.noActiveRecords"),
    automaticCheck: t("countdown.automaticCheck"),
    running: t("countdown.running"),
    waiting: t("countdown.waiting"),
    ariaUntil: t("countdown.ariaUntil"),
    ariaRunning: t("countdown.ariaRunning"),
  };

  return (
    <AppShell
      active="/dashboard"
      title={t("dashboard.title")}
      action={
        <form action={runAllUpdatesAction}>
          <button className="primary-button" type="submit">{t("dashboard.updateAll")}</button>
        </form>
      }
    >
      <div className="dashboard-stack">
        <section className="stats-grid">
          <Stat label={t("dashboard.activeRecords")} value={activeRecords} />
          <Stat label={t("dashboard.providers")} value={providers} />
          <Stat label={t("dashboard.domains")} value={zones} tone="text-sky-300" />
          <Stat label={t("dashboard.interval")} value={`${Math.round(settings.updatePeriodSeconds / 60)}m`} />
          <Stat label={t("dashboard.errors")} value={errorRecords} tone={errorRecords ? "text-rose-300" : "text-emerald-300"} />
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
                <p className="eyebrow">{t("dashboard.recordsEyebrow")}</p>
                <h2>{t("dashboard.recentRecords")}</h2>
              </div>
              <Link className="ghost-link" href="/records">{t("dashboard.showAll")}</Link>
            </div>
            <div className="record-list">
              {records.length === 0 ? (
                <p className="empty-state">{t("dashboard.noRecords")}</p>
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
                      {t("common.lastIp")}: {record.lastIp || "-"} · {t("common.check")}: {formatDateOrNever(record.lastCheckedAt, t, settings.language)}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="panel p-5">
            <div className="section-head">
              <div>
                <p className="eyebrow">{t("dashboard.logsEyebrow")}</p>
                <h2>{t("dashboard.recentEvents")}</h2>
              </div>
              <Link className="ghost-link" href="/logs">{t("dashboard.allLogs")}</Link>
            </div>
            <div className="log-list">
              {logs.length === 0 ? (
                <p className="empty-state">{t("dashboard.noLogs")}</p>
              ) : logs.map((log) => (
                <details className="log-row" key={log.id}>
                  <summary>
                    <span className={`log-dot ${log.level.toLowerCase()}`} />
                    <span>
                      <span className="log-message">{log.message}</span>
                      <span className="log-meta">{log.record?.hostname || t("common.system")} · {formatDateOrNever(log.createdAt, t, settings.language)}</span>
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
