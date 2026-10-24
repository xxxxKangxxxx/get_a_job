// GET /api/google/status → { connected, lastSyncAt, email, error }
import { NextResponse, connection } from "next/server";
import { getCalendarStatus } from "@/lib/google/status";

export async function GET() {
  await connection(); // 빌드 때 미리 실행하지 않고 요청마다 실행
  return NextResponse.json(await getCalendarStatus());
}
