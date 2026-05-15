import { NextRequest, NextResponse } from "next/server";
import { runDdnsUpdate } from "@/lib/ddns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET;
  const providedSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    request.nextUrl.searchParams.get("secret");

  if (expectedSecret && providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await runDdnsUpdate();
  return NextResponse.json({ ok: true, checked: results.length, results });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
