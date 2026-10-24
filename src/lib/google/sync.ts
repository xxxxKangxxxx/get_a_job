// 구글 캘린더 동기화 한 번 돌리기.
// 1) FreeBusy로 개인 일정의 바쁜 시간 → busy_blocks
// 2) 그 바쁜 시간을 반영한 일정(getSchedule)으로 "취업 일정" 캘린더의 이벤트를 맞춘다 (추가·수정·삭제)
import { createHash } from "node:crypto";
import { and, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { googleEventLinks } from "@/db/schema-infra";
import { getSchedule, getSettings, listPostings } from "@/server/queries";
import { addDays, todayKST } from "@/lib/date";
import { getAccount, updateAccount } from "./oauth";
import { calendarExists, createAppCalendar, deleteEvent, freeBusy, insertEvent, updateEvent } from "./calendar";
import { buildDesired, splitBusy } from "./place";
import { replaceGoogleBusy } from "./busy";

export const SYNC_DAYS = 30;

export type SyncResult = {
  busyRows: number;
  created: number;
  updated: number;
  deleted: number;
  unchanged: number;
  calendarId: string;
};

const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 32);

/** 앱 전용 캘린더가 없으면(처음이거나 사용자가 지웠으면) 만든다 */
export async function ensureAppCalendar(): Promise<string> {
  const acc = await getAccount();
  if (!acc) throw new Error("구글 캘린더가 연결되지 않았다");
  if (acc.calendarId && (await calendarExists(acc.calendarId))) return acc.calendarId;
  const id = await createAppCalendar();
  await updateAccount({ calendarId: id });
  // 예전 캘린더의 매핑은 의미가 없어졌다
  await db.delete(googleEventLinks);
  return id;
}

export async function syncBusy(today = todayKST(), days = SYNC_DAYS): Promise<number> {
  const to = addDays(today, days - 1);
  const busy = await freeBusy(`${today}T00:00:00+09:00`, `${addDays(to, 1)}T00:00:00+09:00`, busyCalendarIds());
  return replaceGoogleBusy(today, to, splitBusy(busy));
}

function busyCalendarIds(): string[] {
  const extra = (process.env.GOOGLE_BUSY_CALENDARS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return ["primary", ...extra];
}

export async function syncCalendar(): Promise<SyncResult> {
  const today = todayKST();
  try {
    const calendarId = await ensureAppCalendar();
    const busyRows = await syncBusy(today);

    const [schedule, settings, postings] = await Promise.all([
      getSchedule(SYNC_DAYS),
      getSettings(),
      listPostings({ decision: ["예정"], status: "진행중", limit: 1000 }),
    ]);
    const desired = buildDesired({
      today, days: schedule.days, postings: postings.items, workWindow: settings.workWindow, appUrl: process.env.APP_URL,
    });

    const links = await db.select().from(googleEventLinks).where(eq(googleEventLinks.calendarId, calendarId));
    const byKey = new Map(links.map((l) => [l.key, l]));
    const r: SyncResult = { busyRows, created: 0, updated: 0, deleted: 0, unchanged: 0, calendarId };

    for (const d of desired) {
      const h = hash(d.body);
      const link = byKey.get(d.key);
      byKey.delete(d.key);
      if (link && link.hash === h) { r.unchanged++; continue; }
      if (link && (await updateEvent(calendarId, link.googleEventId, d.body))) {
        await db.update(googleEventLinks).set({ hash: h, date: d.date, updatedAt: new Date() }).where(eq(googleEventLinks.key, d.key));
        r.updated++;
        continue;
      }
      const eventId = await insertEvent(calendarId, d.body);
      const row = { key: d.key, calendarId, googleEventId: eventId, hash: h, date: d.date, updatedAt: new Date() };
      await db.insert(googleEventLinks).values(row).onConflictDoUpdate({ target: googleEventLinks.key, set: row });
      r.created++;
    }

    // 더 이상 없어야 하는 오늘 이후 항목은 지운다. 지난 항목은 기록으로 남긴다.
    for (const link of byKey.values()) {
      if (link.date < today) continue;
      await deleteEvent(calendarId, link.googleEventId);
      await db.delete(googleEventLinks).where(and(eq(googleEventLinks.key, link.key), gte(googleEventLinks.date, today)));
      r.deleted++;
    }

    await updateAccount({ lastSyncAt: new Date(), lastSyncError: null });
    return r;
  } catch (e) {
    await updateAccount({ lastSyncError: e instanceof Error ? e.message : String(e) }).catch(() => {});
    throw e;
  }
}
