// GET /api/cron/briefing — 아침 브리핑 푸시
import { NextResponse, connection } from "next/server";
import { runBriefing, settle } from "../jobs";

export const maxDuration = 60;

export async function GET() {
  await connection(); // 빌드 때 미리 실행하지 않고 요청마다 실행
  const r = await settle(runBriefing);
  return NextResponse.json(r, { status: r.ok ? 200 : 500 });
}
