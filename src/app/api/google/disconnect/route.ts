// POST /api/google/disconnect → "취업 일정" 캘린더를 지우고(선택) 권한을 취소한다.
// body(JSON, 선택): { keepCalendar?: boolean }
import { NextResponse, type NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { googleEventLinks } from "@/db/schema-infra";
import { disconnect, getAccount } from "@/lib/google/oauth";
import { deleteCalendar } from "@/lib/google/calendar";
import { writeCalendarStatus } from "@/lib/google/status";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const acc = await getAccount();
  if (acc?.calendarId && !body?.keepCalendar) await deleteCalendar(acc.calendarId).catch((e) => console.error(e));
  await db.delete(googleEventLinks);
  await db.execute(sql`delete from busy_blocks where source = 'google'`).catch(() => {});
  await disconnect();
  await writeCalendarStatus();
  return NextResponse.json({ ok: true });
}
