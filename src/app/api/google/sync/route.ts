// POST /api/google/sync → 지금 바로 동기화. 결과 건수를 돌려준다.
// 일정이 바뀌는 동작(지원 결정·진행률·설정 변경) 뒤에 화면에서 불러 주면 캘린더가 바로 맞춰진다.
import { NextResponse } from "next/server";
import { syncCalendar } from "@/lib/google/sync";

export async function POST() {
  try {
    return NextResponse.json({ ok: true, ...(await syncCalendar()) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
