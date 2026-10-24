// GET /api/cron/daily — 매일 08:00 KST (vercel.json). Vercel Hobby는 cron이 하루 1회라 한 번에 모두 한다.
// 순서: 캘린더 동기화(바쁜 시간 반영) → 아침 브리핑 → 미결정 A급 공고 알림
import { NextResponse, connection } from "next/server";
import { runBriefing, runDecisions, runGoogleSync, settle } from "../jobs";

export const maxDuration = 60;

export async function GET() {
  await connection(); // 빌드 때 미리 실행하지 않고 요청마다 실행
  const googleSync = await settle(runGoogleSync);
  const briefing = await settle(runBriefing);
  const decisions = await settle(runDecisions);
  const ok = googleSync.ok && briefing.ok && decisions.ok;
  return NextResponse.json({ ok, googleSync, briefing, decisions }, { status: ok ? 200 : 500 });
}
