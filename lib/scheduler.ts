import { runDdnsUpdate } from "@/lib/ddns";
import { createTranslator } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";

type SchedulerState = {
  started: boolean;
  running: boolean;
  timer?: ReturnType<typeof setTimeout>;
  nextRunAt?: Date | null;
  lastRunStartedAt?: Date | null;
  lastRunFinishedAt?: Date | null;
  lastError?: string | null;
};

const gScheduler = globalThis as typeof globalThis & {
  ddnsPlusScheduler?: SchedulerState;
};

const sMinimumIntervalSeconds = 30;
const sStartupDelayMs = 3000;

function getSchedulerState() {
  if (!gScheduler.ddnsPlusScheduler) {
    gScheduler.ddnsPlusScheduler = {
      started: false,
      running: false,
      nextRunAt: null,
      lastRunStartedAt: null,
      lastRunFinishedAt: null,
      lastError: null,
    };
  }

  return gScheduler.ddnsPlusScheduler;
}

function scheduleNextRun(pDelayMs: number) {
  const lState = getSchedulerState();
  const lDelayMs = Math.max(1000, pDelayMs);

  if (lState.timer) {
    clearTimeout(lState.timer);
  }

  lState.nextRunAt = new Date(Date.now() + lDelayMs);
  lState.timer = setTimeout(() => {
    void runScheduledUpdate();
  }, lDelayMs);

  if (typeof lState.timer.unref === "function") {
    lState.timer.unref();
  }
}

async function getNextDelayMs() {
  try {
    const lSettings = await getSettings();
    const lIntervalSeconds = Math.max(
      lSettings.updatePeriodSeconds,
      lSettings.cooldownSeconds,
      sMinimumIntervalSeconds,
    );

    return lIntervalSeconds * 1000;
  } catch {
    return sMinimumIntervalSeconds * 1000;
  }
}

async function runScheduledUpdate() {
  const lState = getSchedulerState();

  if (lState.running) {
    scheduleNextRun(await getNextDelayMs());
    return;
  }

  lState.running = true;
  lState.nextRunAt = null;
  lState.lastRunStartedAt = new Date();
  lState.lastError = null;

  try {
    await runDdnsUpdate();
  } catch (pError) {
    const lSettings = await getSettings();
    const lTranslate = createTranslator(lSettings.language);
    lState.lastError = pError instanceof Error ? pError.message : lTranslate("scheduler.failed");
  } finally {
    lState.running = false;
    lState.lastRunFinishedAt = new Date();
    scheduleNextRun(await getNextDelayMs());
  }
}

export function startDdnsScheduler() {
  if (process.env.DDNS_PLUS_SCHEDULER === "false") return;

  const lState = getSchedulerState();
  if (lState.started) return;

  lState.started = true;
  scheduleNextRun(sStartupDelayMs);
}

export function getDdnsSchedulerStatus() {
  const lState = getSchedulerState();

  return {
    started: lState.started,
    running: lState.running,
    nextRunAt: lState.nextRunAt ?? null,
    lastRunStartedAt: lState.lastRunStartedAt ?? null,
    lastRunFinishedAt: lState.lastRunFinishedAt ?? null,
    lastError: lState.lastError ?? null,
  };
}
