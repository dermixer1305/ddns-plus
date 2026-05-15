import { AppShell } from "@/app/app-shell";
import { formatDateOrNever } from "@/app/ui";
import { createTranslator } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

export default async function LogsPage() {
  const [logs, settings] = await Promise.all([
    prisma.updateLog.findMany({
      include: { record: { include: { provider: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    getSettings(),
  ]);
  const t = createTranslator(settings.language);

  return (
    <AppShell active="/logs" title={t("logs.title")} eyebrow={t("logs.eyebrow")}>
      <section className="panel p-5">
        <p className="eyebrow">{t("logs.listEyebrow")}</p>
        <h2>{t("logs.recentEvents")}</h2>
        <div className="log-list">
          {logs.length === 0 ? (
            <p className="empty-state">{t("logs.empty")}</p>
          ) : logs.map((log) => (
            <details className="log-row" key={log.id}>
              <summary>
                <span className={`log-dot ${log.level.toLowerCase()}`} />
                <span>
                  <span className="log-message">{log.message}</span>
                  <span className="log-meta">{log.record?.hostname || t("common.system")} · {formatDateOrNever(log.createdAt, t, settings.language)}</span>
                </span>
              </summary>
              <dl className="log-details">
                <div>
                  <dt>{t("common.level")}</dt>
                  <dd>{log.level}</dd>
                </div>
                <div>
                  <dt>{t("common.provider")}</dt>
                  <dd>{log.record?.provider.name || "-"}</dd>
                </div>
                <div>
                  <dt>{t("logs.providerType")}</dt>
                  <dd>{log.record?.provider.type || "-"}</dd>
                </div>
                <div>
                  <dt>{t("common.hostname")}</dt>
                  <dd>{log.record?.hostname || "-"}</dd>
                </div>
                <div>
                  <dt>{t("common.zone")}</dt>
                  <dd>{log.record?.zoneId || "-"}</dd>
                </div>
                <div>
                  <dt>{t("common.record")}</dt>
                  <dd>{log.record ? `${log.record.recordName} (${log.record.recordType})` : "-"}</dd>
                </div>
                <div>
                  <dt>{t("common.ip")}</dt>
                  <dd>{log.ip || "-"}</dd>
                </div>
                <div className="wide">
                  <dt>{t("common.message")}</dt>
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
