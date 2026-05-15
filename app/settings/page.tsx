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
  const providerOptions = [
    { value: "IPIFY", label: "ipify" },
    { value: "ICANHAZIP", label: "icanhazip" },
    { value: "IDENT", label: "ident.me" },
    { value: "SEEIP", label: "seeip" },
  ];

  return (
    <AppShell active="/settings" title={t("settings.title")} eyebrow={t("settings.eyebrow")}>
      <section className="stats-grid">
        <Stat label="Intervall" value={`${settings.updatePeriodSeconds}s`} />
        <Stat label="Cooldown" value={`${settings.cooldownSeconds}s`} />
        <Stat label="Timeout" value={`${settings.httpTimeoutSeconds}s`} />
      </section>
      <RefreshCountdown
        nextRefreshAt={nextRefresh?.toISOString() || null}
        intervalSeconds={refreshIntervalSeconds}
        lastUpdateFinishedAt={settings.lastUpdateFinishedAt?.toISOString() || null}
        lastUpdateStatus={settings.lastUpdateStatus}
      />
      <CurrentIpCards />
      <section className="panel p-5">
        <p className="eyebrow">Updater</p>
        <h2>Automatische Updates</h2>
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
            label="Intervall Sekunden"
            type="number"
            defaultValue={settings.updatePeriodSeconds}
          />
          <TextInput
            name="cooldownSeconds"
            label="Cooldown Sekunden"
            type="number"
            defaultValue={settings.cooldownSeconds}
          />
          <TextInput
            name="httpTimeoutSeconds"
            label="HTTP Timeout"
            type="number"
            defaultValue={settings.httpTimeoutSeconds}
          />
          <SelectInput
            name="ipv4Provider"
            label="IPv4 Fetcher"
            defaultValue={settings.ipv4Provider}
            options={providerOptions}
          />
          <SelectInput
            name="ipv6Provider"
            label="IPv6 Fetcher"
            defaultValue={settings.ipv6Provider}
            options={providerOptions}
          />
          <button className="secondary-button" type="submit">{t("settings.save")}</button>
        </form>
      </section>
    </AppShell>
  );
}
