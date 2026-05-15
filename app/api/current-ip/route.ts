import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getSettings();
  return NextResponse.json({
    ipv4: {
      ip: settings.lastPublicIpv4,
      error: settings.lastPublicIpv4Error,
      checkedAt: settings.lastPublicIpv4At,
    },
    ipv6: {
      ip: settings.lastPublicIpv6,
      error: settings.lastPublicIpv6Error,
      checkedAt: settings.lastPublicIpv6At,
    },
  });
}
