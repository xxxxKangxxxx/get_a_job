// POST /api/justdo/sync — 지금 바로 justdo에 접수 기간을 보낸다 (로그인 쿠키 필요, proxy가 확인).
import { NextResponse } from "next/server";
import { runJustdoSync, settle } from "../../cron/jobs";

export async function POST() {
  const r = await settle(runJustdoSync);
  return NextResponse.json(r, { status: r.ok ? 200 : 500 });
}
