// 캘린더 연결 상태 (contracts의 CalendarStatus).
// 백엔드는 meta 표 key "calendar_status"({ connected, lastSyncAt })를 읽는다 → 연결·동기화·끊기 때마다 여기서 쓴다.
import type { CalendarStatus } from "@/contracts/types";
import { db, schema } from "@/db";
import { getAccount } from "./oauth";

export async function getCalendarStatus(): Promise<CalendarStatus & { email: string | null; error: string | null }> {
  const acc = await getAccount().catch(() => null);
  return {
    connected: !!acc,
    lastSyncAt: acc?.lastSyncAt?.toISOString() ?? null,
    email: acc?.email ?? null,
    error: acc?.lastSyncError ?? null,
  };
}

export async function writeCalendarStatus(): Promise<void> {
  const { connected, lastSyncAt } = await getCalendarStatus();
  const value: CalendarStatus = { connected, lastSyncAt };
  await db.insert(schema.meta).values({ key: "calendar_status", value })
    .onConflictDoUpdate({ target: schema.meta.key, set: { value } });
}
