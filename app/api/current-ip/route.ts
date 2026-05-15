import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const [settings, activeRecordTypes] = await Promise.all([
    getSettings(),
    prisma.ddnsRecord.findMany({
      where: { enabled: true },
      select: { recordType: true },
      distinct: ["recordType"],
    }),
  ]);
  const neededTypes = new Set(activeRecordTypes.map((record) => record.recordType));

  return NextResponse.json({
    ipv4: {
      ip: settings.lastPublicIpv4,
      error: settings.lastPublicIpv4Error,
      checkedAt: settings.lastPublicIpv4At,
      needed: neededTypes.has("A"),
    },
    ipv6: {
      ip: settings.lastPublicIpv6,
      error: settings.lastPublicIpv6Error,
      checkedAt: settings.lastPublicIpv6At,
      needed: neededTypes.has("AAAA"),
    },
  });
}
