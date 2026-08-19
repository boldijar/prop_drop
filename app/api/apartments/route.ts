import { NextResponse } from "next/server";
import { buildVersion, loadApartments, loadSyncConfig } from "@/lib/upstash";

export async function GET() {
  try {
    const [syncConfig, apartments] = await Promise.all([
      loadSyncConfig(),
      loadApartments(),
    ]);
    const version = buildVersion(syncConfig, apartments);
    return NextResponse.json({
      version,
      syncConfig,
      apartments,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
