import { RecordType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { detectPublicIp } from "@/lib/public-ip";
import { getProviderAdapter } from "@/lib/providers/registry";
import { DdnsRecordWithProvider } from "@/lib/providers/types";
import { getSettings, RuntimeSettings } from "@/lib/settings";

export async function updateDdnsRecord(record: DdnsRecordWithProvider, settings: RuntimeSettings, force = false) {
  if (!record.enabled) {
    await writeResult(record.id, "SKIPPED", "INFO", "Eintrag ist deaktiviert");
    return { status: "SKIPPED" as const, message: "Eintrag ist deaktiviert" };
  }

  if (!force && record.lastCheckedAt) {
    const waitPeriodSeconds = Math.max(settings.updatePeriodSeconds, settings.cooldownSeconds);
    const nextAllowedAt = record.lastCheckedAt.getTime() + waitPeriodSeconds * 1000;
    if (nextAllowedAt > Date.now()) {
      const waitSeconds = Math.ceil((nextAllowedAt - Date.now()) / 1000);
      await writeSkipResult(record.id, `Cooldown aktiv, nächster Check in ${waitSeconds}s`);
      return { status: "SKIPPED" as const, message: "Cooldown aktiv" };
    }
  }

  try {
    const ip = await getPublicIpForRecord(record.recordType);
    const provider = getProviderAdapter(record.provider.type);
    const result = await provider.updateRecord({ record, ip, settings });

    if (!result.changed) {
      await writeResult(record.id, "OK", "INFO", result.message, ip);
      return { status: "OK" as const, message: result.message, ip };
    }

    await writeResult(record.id, "CHANGED", "INFO", result.message, ip, true);
    return { status: "CHANGED" as const, message: result.message, ip };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    const contextMessage =
      `${record.provider.type} ${record.hostname} ${record.recordType} ` +
      `(zone=${record.zoneId}, record=${record.recordName}): ${message}`;
    await writeResult(record.id, "ERROR", "ERROR", contextMessage);
    return { status: "ERROR" as const, message: contextMessage };
  }
}

export async function runDdnsUpdate(recordId?: string, force = false) {
  const settings = await getSettings();
  await markUpdateStarted(recordId ? "manual-record" : force ? "manual-all" : "cron");
  const records = await prisma.ddnsRecord.findMany({
    where: recordId ? { id: recordId } : { enabled: true },
    include: { provider: true },
    orderBy: { hostname: "asc" },
  });
  try {
    await refreshPublicIpsForRecords(records.map((record) => record.recordType), settings);

    const results = [];
    for (const record of records) {
      results.push({
        recordId: record.id,
        hostname: record.hostname,
        ...(await updateDdnsRecord(record, settings, force || Boolean(recordId))),
      });
    }

    await markUpdateFinished("OK", `${results.length} Records geprüft`);
    return results;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update fehlgeschlagen";
    await markUpdateFinished("ERROR", message);
    throw error;
  }
}

async function markUpdateStarted(source: string) {
  await prisma.appSettings.update({
    where: { id: "default" },
    data: {
      lastUpdateStartedAt: new Date(),
      lastUpdateStatus: "RUNNING",
      lastUpdateMessage: source,
    },
  });
}

async function markUpdateFinished(status: "OK" | "ERROR", message: string) {
  await prisma.appSettings.update({
    where: { id: "default" },
    data: {
      lastUpdateFinishedAt: new Date(),
      lastUpdateStatus: status,
      lastUpdateMessage: message,
    },
  });
}

async function refreshPublicIpsForRecords(recordTypes: RecordType[], settings: RuntimeSettings) {
  const uniqueTypes = [...new Set(recordTypes)];

  await Promise.all(uniqueTypes.map((recordType) => refreshPublicIp(recordType, settings)));
}

async function refreshPublicIp(recordType: RecordType, settings: RuntimeSettings) {
  try {
    const ip = await detectPublicIp(recordType, settings);
    await prisma.appSettings.update({
      where: { id: "default" },
      data: recordType === "A"
        ? { lastPublicIpv4: ip, lastPublicIpv4Error: null, lastPublicIpv4At: new Date() }
        : { lastPublicIpv6: ip, lastPublicIpv6Error: null, lastPublicIpv6At: new Date() },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "IP-Erkennung fehlgeschlagen";
    await prisma.appSettings.update({
      where: { id: "default" },
      data: recordType === "A"
        ? { lastPublicIpv4Error: message, lastPublicIpv4At: new Date() }
        : { lastPublicIpv6Error: message, lastPublicIpv6At: new Date() },
    });
  }
}

async function getPublicIpForRecord(recordType: RecordType) {
  const latestSettings = await getSettings();
  const ip = recordType === "A" ? latestSettings.lastPublicIpv4 : latestSettings.lastPublicIpv6;
  const error = recordType === "A" ? latestSettings.lastPublicIpv4Error : latestSettings.lastPublicIpv6Error;

  if (ip) return ip;
  throw new Error(error || `${recordType === "A" ? "IPv4" : "IPv6"} wurde noch nicht erkannt`);
}

async function writeResult(
  recordId: string,
  status: "OK" | "CHANGED" | "ERROR" | "SKIPPED",
  level: "INFO" | "WARN" | "ERROR",
  message: string,
  ip?: string,
  changed = false,
) {
  await prisma.$transaction([
    prisma.ddnsRecord.update({
      where: { id: recordId },
      data: {
        lastIp: ip,
        lastStatus: status,
        lastMessage: message,
        lastCheckedAt: new Date(),
        lastChangedAt: changed ? new Date() : undefined,
      },
    }),
    prisma.updateLog.create({
      data: { recordId, level, message, ip },
    }),
  ]);
}

async function writeSkipResult(recordId: string, message: string) {
  await prisma.ddnsRecord.update({
    where: { id: recordId },
    data: {
      lastStatus: "SKIPPED",
      lastMessage: message,
    },
  });
}
