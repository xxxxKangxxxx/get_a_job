// GET /api/cron/google-sync — 구글 캘린더 동기화 (GitHub Actions로 하루 여러 번 부를 때)
import { NextResponse, connection } from "next/server";
import { runGoogleSync, settle } from "../jobs";

export const maxDuration = 60;

export async function GET() {
  await connection(); // 빌드 때 미리 실행하지 않고 요청마다 실행
  const r = await settle(runGoogleSync);
  return NextResponse.json(r, { status: r.ok ? 200 : 500 });
}
