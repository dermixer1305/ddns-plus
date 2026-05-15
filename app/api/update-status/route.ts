import { NextResponse } from "next/server";
import { getDdnsSchedulerStatus } from "@/lib/scheduler";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const settings = await getSettings();
  const scheduler = getDdnsSchedulerStatus();

  return NextResponse.json({
    updatePeriodSeconds: settings.updatePeriodSeconds,
    cooldownSeconds: settings.cooldownSeconds,
    lastUpdateStartedAt: settings.lastUpdateStartedAt,
    lastUpdateFinishedAt: settings.lastUpdateFinishedAt,
    lastUpdateStatus: settings.lastUpdateStatus,
    lastUpdateMessage: settings.lastUpdateMessage,
    scheduler,
  });
}
