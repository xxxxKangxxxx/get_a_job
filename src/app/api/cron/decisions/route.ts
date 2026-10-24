// GET /api/cron/decisions — 미결정 A급 공고 알림
import { NextResponse, connection } from "next/server";
import { runDecisions, settle } from "../jobs";

export const maxDuration = 60;

export async function GET() {
  await connection(); // 빌드 때 미리 실행하지 않고 요청마다 실행
  const r = await settle(runDecisions);
  return NextResponse.json(r, { status: r.ok ? 200 : 500 });
}
