import { saveSettingsAction } from "@/app/actions";
import { AppShell } from "@/app/app-shell";
import { CurrentIpCards } from "@/app/current-ip-card";
import { RefreshCountdown } from "@/app/refresh-countdown";
import { getNextRefresh, SelectInput, Stat, TextInput } from "@/app/ui";
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
  const providerOptions = [
    { value: "IPIFY", label: "ipify" },
    { value: "ICANHAZIP", label: "icanhazip" },
    { value: "IDENT", label: "ident.me" },
    { value: "SEEIP", label: "seeip" },
  ];

  return (
    <AppShell active="/settings" title="Settings" eyebrow="Updater automation">
      <div className="dashboard-stack">
        <section className="stats-grid">
          <Stat label="Interval" value={`${settings.updatePeriodSeconds}s`} />
          <Stat label="Cooldown" value={`${settings.cooldownSeconds}s`} />
          <Stat label="Timeout" value={`${settings.httpTimeoutSeconds}s`} />
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
          <p className="eyebrow">Updater</p>
          <h2>Automatic updates</h2>
          <form action={saveSettingsAction} className="settings-grid mt-5">
            <TextInput
              name="updatePeriodSeconds"
              label="Interval seconds"
              type="number"
              defaultValue={settings.updatePeriodSeconds}
            />
            <TextInput
              name="cooldownSeconds"
              label="Cooldown seconds"
              type="number"
              defaultValue={settings.cooldownSeconds}
            />
            <TextInput
              name="httpTimeoutSeconds"
              label="HTTP timeout"
              type="number"
              defaultValue={settings.httpTimeoutSeconds}
            />
            <SelectInput
              name="ipv4Provider"
            label="IPv4 fetcher"
              defaultValue={settings.ipv4Provider}
              options={providerOptions}
            />
            <SelectInput
              name="ipv6Provider"
            label="IPv6 fetcher"
              defaultValue={settings.ipv6Provider}
              options={providerOptions}
            />
            <button className="secondary-button" type="submit">Save settings</button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
