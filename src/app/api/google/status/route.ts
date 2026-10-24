// GET /api/google/status → { connected, lastSyncAt, email, error }
import { NextResponse } from "next/server";
import { getCalendarStatus } from "@/lib/google/status";

export async function GET() {
  return NextResponse.json(await getCalendarStatus());
}
