// 화면에 보여 줄 캘린더 연결 상태 (contracts의 CalendarStatus). 백엔드 queries가 그대로 써도 된다.
import type { CalendarStatus } from "@/contracts/types";
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
