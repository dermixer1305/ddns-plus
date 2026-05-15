import { saveSettingsAction } from "@/app/actions";
import { AppShell } from "@/app/app-shell";
import { CurrentIpCards } from "@/app/current-ip-card";
import { RefreshCountdown } from "@/app/refresh-countdown";
import { getNextRefresh, SelectInput, Stat, TextInput } from "@/app/ui";
import { createTranslator, languageOptions } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

export default async function SettingsPage() {
  const [settings, records] = await Promise.all([
    getSettings(),
    prisma.ddnsRecord.findMany({
      select: { enabled: true, lastCheckedAt: true },
      orderBy: { hostname: "asc" },
    }),
  ]);
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
  const providerOptions = [
    { value: "IPIFY", label: "ipify" },
    { value: "ICANHAZIP", label: "icanhazip" },
    { value: "IDENT", label: "ident.me" },
    { value: "SEEIP", label: "seeip" },
  ];

  return (
    <AppShell active="/settings" title={t("settings.title")} eyebrow={t("settings.eyebrow")}>
      <div className="dashboard-stack">
        <section className="stats-grid">
          <Stat label={t("dashboard.interval")} value={`${settings.updatePeriodSeconds}s`} />
          <Stat label={t("settings.cooldown")} value={`${settings.cooldownSeconds}s`} />
          <Stat label={t("settings.timeout")} value={`${settings.httpTimeoutSeconds}s`} />
        </section>
        <RefreshCountdown
          nextRefreshAt={nextRefresh?.toISOString() || null}
          intervalSeconds={refreshIntervalSeconds}
          lastUpdateFinishedAt={settings.lastUpdateFinishedAt?.toISOString() || null}
          lastUpdateStatus={settings.lastUpdateStatus}
          texts={countdownTexts}
        />
        <CurrentIpCards texts={ipTexts} />
        <section className="panel p-5">
          <p className="eyebrow">{t("settings.updaterEyebrow")}</p>
          <h2>{t("settings.automaticUpdates")}</h2>
          <form action={saveSettingsAction} className="settings-grid mt-5">
            <label className="field">
              <span>{t("settings.language")}</span>
              <select name="language" defaultValue={settings.language}>
                {languageOptions.map((option) => (
                  <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
                ))}
              </select>
            </label>
            <TextInput
              name="updatePeriodSeconds"
              label={t("settings.intervalSeconds")}
              type="number"
              defaultValue={settings.updatePeriodSeconds}
            />
            <TextInput
              name="cooldownSeconds"
              label={t("settings.cooldownSeconds")}
              type="number"
              defaultValue={settings.cooldownSeconds}
            />
            <TextInput
              name="httpTimeoutSeconds"
              label={t("settings.httpTimeout")}
              type="number"
              defaultValue={settings.httpTimeoutSeconds}
            />
            <SelectInput
              name="ipv4Provider"
            label={t("settings.ipv4Fetcher")}
              defaultValue={settings.ipv4Provider}
              options={providerOptions}
            />
            <SelectInput
              name="ipv6Provider"
            label={t("settings.ipv6Fetcher")}
              defaultValue={settings.ipv6Provider}
              options={providerOptions}
            />
            <button className="secondary-button" type="submit">{t("settings.save")}</button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
