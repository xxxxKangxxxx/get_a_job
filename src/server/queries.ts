// 화면이 데이터를 읽을 때 부르는 함수들 (서버 컴포넌트에서 await 해서 사용).
// 지금은 가짜 데이터를 돌려준다. 백엔드가 같은 이름·모양으로 실제 DB 구현으로 바꾼다.
import type {
  TodayView, ScheduleView, InboxView, BoardView, PostingFilter, PostingSummary, PostingDetail,
  AppSettings, HideRule,
} from "@/contracts/types";
import { TODAY, SCHEDULE, INBOX, BOARD, POSTINGS, EVENTS, SETTINGS } from "./mock";

export async function getToday(): Promise<TodayView> {
  return TODAY;
}

/** days: 오늘부터 며칠치 (기본 14) */
export async function getSchedule(days = 14): Promise<ScheduleView> {
  void days;
  return SCHEDULE;
}

export async function getInbox(): Promise<InboxView> {
  return INBOX;
}

export async function getBoard(): Promise<BoardView> {
  return BOARD;
}

export async function listPostings(filter: PostingFilter = {}): Promise<{ items: PostingSummary[]; total: number }> {
  const q = filter.q?.trim();
  const items = POSTINGS.filter((x) => !q || x.company.includes(q) || x.title.includes(q));
  return { items, total: items.length };
}

export async function getPosting(id: string): Promise<PostingDetail | null> {
  const x = POSTINGS.find((p) => p.id === id);
  if (!x) return null;
  return { ...x, companyTypeBasis: null, surveyedAt: "2026-10-23", events: EVENTS.filter((e) => e.postingId === id), application: null };
}

export async function getSettings(): Promise<AppSettings> {
  return SETTINGS;
}

export async function listHideRules(): Promise<HideRule[]> {
  return [{ id: 1, kind: "location", value: "울산", hiddenCount: 14, createdAt: "2026-10-20T10:00:00+09:00" }];
}
