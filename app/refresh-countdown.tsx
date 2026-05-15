"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type SchedulerStatus = {
  started: boolean;
  running: boolean;
  nextRunAt: string | null;
  lastRunStartedAt: string | null;
  lastRunFinishedAt: string | null;
  lastError: string | null;
};

function formatCountdown(milliseconds: number) {
  if (milliseconds <= 0) return null;

  const totalSeconds = Math.ceil(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

export function RefreshCountdown({
  nextRefreshAt,
  intervalSeconds,
  lastUpdateFinishedAt,
  lastUpdateStatus,
  texts,
}: {
  nextRefreshAt: string | null;
  intervalSeconds: number;
  lastUpdateFinishedAt?: string | null;
  lastUpdateStatus?: string | null;
  texts: {
    noActiveRecords: string;
    automaticCheck: string;
    running: string;
    waiting: string;
    ariaUntil: string;
    ariaRunning: string;
  };
}) {
  const router = useRouter();
  const [knownFinishedAt, setKnownFinishedAt] = useState(lastUpdateFinishedAt || null);
  const [status, setStatus] = useState({
    lastUpdateFinishedAt: lastUpdateFinishedAt || null,
    lastUpdateStatus: lastUpdateStatus || null,
    intervalSeconds,
    scheduler: null as SchedulerStatus | null,
  });
  const targetTime = status.scheduler?.nextRunAt
    ? new Date(status.scheduler.nextRunAt).getTime()
    : status.lastUpdateFinishedAt
      ? new Date(status.lastUpdateFinishedAt).getTime() + status.intervalSeconds * 1000
      : nextRefreshAt ? new Date(nextRefreshAt).getTime() : null;
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const initialTimeout = window.setTimeout(() => setNow(Date.now()), 0);
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearTimeout(initialTimeout);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadStatus() {
      try {
        const response = await fetch("/api/update-status", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const body = await response.json() as {
          updatePeriodSeconds: number;
          cooldownSeconds: number;
          lastUpdateFinishedAt: string | null;
          lastUpdateStatus: string | null;
          scheduler: SchedulerStatus;
        };

        setStatus({
          lastUpdateFinishedAt: body.lastUpdateFinishedAt,
          lastUpdateStatus: body.lastUpdateStatus,
          intervalSeconds: Math.max(body.updatePeriodSeconds, body.cooldownSeconds),
          scheduler: body.scheduler,
        });
        if (body.lastUpdateFinishedAt && body.lastUpdateFinishedAt !== knownFinishedAt) {
          setKnownFinishedAt(body.lastUpdateFinishedAt);
          router.refresh();
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    const initialTimeout = window.setTimeout(loadStatus, 0);
    const interval = window.setInterval(loadStatus, 5000);
    return () => {
      controller.abort();
      window.clearTimeout(initialTimeout);
      window.clearInterval(interval);
    };
  }, [knownFinishedAt, router]);

  if (!targetTime) {
    return (
      <div className="countdown-card">
        <p>{texts.noActiveRecords}</p>
        <div className="countdown-track">
          <div className="countdown-bar empty" />
        </div>
      </div>
    );
  }

  if (now === null) {
    return (
      <div className="countdown-card">
        <div className="countdown-head">
          <span>{texts.automaticCheck}</span>
          <strong>...</strong>
        </div>
        <div className="countdown-track" aria-label={texts.ariaUntil}>
          <div className="countdown-bar" style={{ width: "100%" }} />
        </div>
      </div>
    );
  }

  if (status.scheduler?.running || status.lastUpdateStatus === "RUNNING") {
    return (
      <div className="countdown-card">
        <div className="countdown-head">
          <span>{texts.automaticCheck}</span>
          <strong>{texts.running}</strong>
        </div>
        <div className="countdown-track" aria-label={texts.ariaRunning}>
          <div className="countdown-bar running" />
        </div>
      </div>
    );
  }

  const total = Math.max(status.intervalSeconds * 1000, 1000);
  const remaining = Math.max(0, targetTime - now);
  const progress = Math.max(0, Math.min(100, (remaining / total) * 100));

  return (
    <div className="countdown-card">
      <div className="countdown-head">
        <span>{texts.automaticCheck}</span>
        <strong>{formatCountdown(remaining) || texts.waiting}</strong>
      </div>
      <div className="countdown-track" aria-label={texts.ariaUntil}>
        <div className={`countdown-bar ${remaining <= 0 ? "overdue" : ""}`} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
