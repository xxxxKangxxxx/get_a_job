// queries.ts·actions.ts가 함께 쓰는 DB 읽기 도우미.
import { and, asc, eq, gte, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import type {
  AppSettings, ApplicationCard, BoardColumnKey, CalendarStatus, Decision, EventItem, EventKind, Fit,
  PostingSummary, TodayTask,
} from "../contracts/types";
import type { DB } from "../db";
import { applications, busyBlocks, dailyPlans, events, hideRules, meta, postings, type Application, type Posting } from "../db/schema";
import { addDays, diffDays } from "../lib/date";
import { mergeSettings } from "./settings";
import { firstMatchingRule } from "./hide-rules";
import type { PlanEvent, PlanInput, PlanPosting } from "./plan";

/** 적합도 A·미결정 공고를 "결정 필요"로 올리는 마감 기준 (D-7 이내) */
export const NEED_DECISION_DAYS = 7;

export type DailyPlanState = { done: Record<string, TodayTask> };

export async function loadSettings(db: DB): Promise<AppSettings> {
  const [row] = await db.select().from(meta).where(eq(meta.key, "settings"));
  return mergeSettings(row?.value);
}

export async function loadSourceMeta(db: DB): Promise<{ 전형단계?: string[]; 전형칼럼?: Record<string, string> }> {
  const [row] = await db.select().from(meta).where(eq(meta.key, "source_meta"));
  return (row?.value ?? {}) as { 전형단계?: string[]; 전형칼럼?: Record<string, string> };
}

/** 인프라가 meta.calendar_status에 { connected, lastSyncAt }을 쓴다. 없으면 연결 안 됨. */
export async function loadCalendarStatus(db: DB): Promise<CalendarStatus> {
  const [row] = await db.select().from(meta).where(eq(meta.key, "calendar_status"));
  const v = (row?.value ?? {}) as Partial<CalendarStatus>;
  return { connected: !!v.connected, lastSyncAt: v.lastSyncAt ?? null };
}

const asFit = (s: string): Fit => (s === "A" || s === "B" || s === "C" ? s : "");

export function toSummary(p: Posting, today: string): PostingSummary {
  return {
    id: p.id,
    company: p.company,
    title: p.title,
    jobCategory: p.jobCategory,
    companyType: p.companyType,
    employmentType: p.employmentType,
    location: p.location,
    openDate: p.openDate,
    deadline: p.deadline,
    deadlineTime: p.deadlineTime,
    rolling: p.rolling,
    dday: p.deadline ? diffDays(today, p.deadline) : null,
    fit: asFit(p.fit),
    decision: p.decision as Decision,
    status: p.status === "마감" ? "마감" : "진행중",
    source: p.source,
    url: p.url,
    notes: p.notes,
    estHours: p.estHours,
    progress: p.progress,
    origin: p.origin === "manual" ? "manual" : "collected",
  };
}

export function toPlanPosting(p: Posting | PostingSummary): PlanPosting {
  return {
    id: p.id, company: p.company, title: p.title, jobCategory: p.jobCategory, deadline: p.deadline,
    deadlineTime: p.deadlineTime, rolling: p.rolling, fit: asFit(p.fit), estHours: p.estHours, progress: p.progress,
  };
}

export function toEventItem(e: typeof events.$inferSelect): EventItem {
  return {
    id: e.id, kind: e.kind as EventKind, title: e.title, date: e.date, time: e.time,
    postingId: e.postingId, applicationId: e.applicationId, done: e.done,
  };
}

export async function loadDailyPlan(db: DB, date: string): Promise<DailyPlanState> {
  const [row] = await db.select().from(dailyPlans).where(eq(dailyPlans.date, date));
  const plan = (row?.plan ?? {}) as Partial<DailyPlanState>;
  return { done: plan.done ?? {} };
}

export async function saveDailyPlan(db: DB, date: string, state: DailyPlanState, availableHours: number) {
  const checked = Object.keys(state.done);
  await db.insert(dailyPlans).values({ date, availableHours, input: {}, plan: state, checked })
    .onConflictDoUpdate({ target: dailyPlans.date, set: { plan: state, checked, availableHours } });
}

/** 일정 엔진 입력을 DB에서 모은다. */
export async function loadPlanInput(db: DB, today: string): Promise<PlanInput> {
  const settings = await loadSettings(db);
  const planned = await db.select().from(postings).where(eq(postings.decision, "예정"));

  const evRows = await db.select().from(events).where(gte(events.date, today)).orderBy(asc(events.date), asc(events.time));
  const appIds = [...new Set(evRows.map((e) => e.applicationId).filter((x): x is string => !!x))];
  const postIds = [...new Set(evRows.map((e) => e.postingId).filter((x): x is string => !!x))];
  const apps = appIds.length ? await db.select({ id: applications.id, company: applications.company, postingId: applications.postingId })
    .from(applications).where(inArray(applications.id, appIds)) : [];
  const appById = new Map(apps.map((a) => [a.id, a]));
  for (const a of apps) if (a.postingId) postIds.push(a.postingId);
  const posts = postIds.length ? await db.select({ id: postings.id, company: postings.company, fit: postings.fit })
    .from(postings).where(inArray(postings.id, postIds)) : [];
  const postById = new Map(posts.map((p) => [p.id, p]));

  const planEvents: PlanEvent[] = evRows.map((e) => {
    const app = e.applicationId ? appById.get(e.applicationId) : undefined;
    const post = postById.get(e.postingId ?? app?.postingId ?? "");
    // 연결된 공고가 없으면 면접·인적성은 중요하다고 보고 A로 친다
    return { ...toEventItem(e), company: app?.company ?? post?.company ?? "", fit: post ? asFit(post.fit) || "A" : "A" };
  });

  const busy = await db.select().from(busyBlocks).where(gte(busyBlocks.date, today));

  // 지난 2주 동안 체크한 준비 시간
  const recent = await db.select().from(dailyPlans).where(gte(dailyPlans.date, addDays(today, -14)));
  const donePrepHours: Record<number, number> = {};
  let checkedToday: Record<string, TodayTask> = {};
  for (const r of recent) {
    const done = ((r.plan ?? {}) as Partial<DailyPlanState>).done ?? {};
    if (r.date === today) checkedToday = done;
    for (const [id, t] of Object.entries(done)) {
      const m = /:p:(\d+)$/.exec(id);
      if (m) donePrepHours[Number(m[1])] = (donePrepHours[Number(m[1])] ?? 0) + t.hours;
    }
  }

  return {
    today, settings,
    postings: planned.map(toPlanPosting),
    events: planEvents,
    busy: busy.map((b) => ({ date: b.date, start: b.start, end: b.end, title: b.title })),
    donePrepHours,
    checkedToday,
  };
}

/** 받은편지함에 올라갈 공고와 이유 */
export async function loadInboxRows(db: DB, today: string) {
  const rows = await db.select().from(postings).where(and(
    eq(postings.status, "진행중"),
    isNull(postings.hiddenByRule),
    or(eq(postings.decision, ""), and(eq(postings.decision, "보류"), eq(postings.fit, "A"))),
    or(isNull(postings.deadline), gte(postings.deadline, today)),
  ));
  const near = addDays(today, NEED_DECISION_DAYS);
  type Card = { row: Posting; reason: "new" | "needDecision" };
  const cards = rows.flatMap((p): Card[] => {
    const needDecision = p.fit === "A" && !!p.deadline && p.deadline <= near;
    if (needDecision) return [{ row: p, reason: "needDecision" as const }];
    if (p.decision === "") return [{ row: p, reason: "new" as const }];
    return []; // 보류는 결정이 급할 때만 다시 올린다
  });
  cards.sort((a, b) =>
    Number(b.reason === "needDecision") - Number(a.reason === "needDecision")
    || (a.row.deadline ?? "9999").localeCompare(b.row.deadline ?? "9999")
    || a.row.company.localeCompare(b.row.company));
  const [{ n: autoHidden }] = await db.select({ n: sql<number>`count(*)::int` }).from(postings).where(and(
    eq(postings.decision, ""), isNotNull(postings.hiddenByRule), eq(postings.status, "진행중"),
  ));
  return {
    cards,
    counts: {
      new: cards.filter((c) => c.reason === "new" && c.row.inboxState === "new").length,
      needDecision: cards.filter((c) => c.reason === "needDecision").length,
      autoHidden,
    },
  };
}

// ---------------- 지원 현황 ----------------

const COLUMNS: BoardColumnKey[] = ["준비 중", "서류", "인적성", "1차면접", "2차면접", "최종", "탈락"];
export const ENDED_STAGES = ["최종 합격", "불합격", "불참·포기"];

/** meta.전형칼럼에 없으면 단계 이름으로 짐작한다 */
export function columnOf(stage: string, map: Record<string, string> = {}): BoardColumnKey {
  const m = map[stage];
  if (m && (COLUMNS as string[]).includes(m)) return m as BoardColumnKey;
  if (stage === "불합격" || stage.includes("포기")) return "탈락";
  if (stage.includes("최종")) return "최종";
  if (stage.includes("2차면접")) return "2차면접";
  if (stage.includes("1차면접")) return "1차면접";
  if (stage.includes("인적성")) return "인적성";
  return "서류";
}

export function toApplicationCard(a: Application, colMap: Record<string, string>, nextEvent: EventItem | null): ApplicationCard {
  return {
    id: a.id, postingId: a.postingId, company: a.company, title: a.title, jobCategory: a.jobCategory,
    appliedAt: a.appliedAt, stage: a.stage, column: columnOf(a.stage, colMap), nextEvent,
    progress: null, deadline: a.deadline, historyNote: a.historyNote, url: a.url,
  };
}

/** 지원별 다가오는 첫 일정 */
export async function loadNextEvents(db: DB, today: string, appIds?: string[]): Promise<Map<string, EventItem>> {
  const rows = await db.select().from(events).where(and(
    gte(events.date, today), eq(events.done, false),
    appIds ? inArray(events.applicationId, appIds.length ? appIds : [""]) : sql`${events.applicationId} is not null`,
  )).orderBy(asc(events.date), asc(events.time));
  const m = new Map<string, EventItem>();
  for (const e of rows) if (e.applicationId && !m.has(e.applicationId)) m.set(e.applicationId, toEventItem(e));
  return m;
}

export { COLUMNS };

// ---------------- 숨김 규칙 ----------------

/**
 * 미결정 공고에 숨김 규칙을 적용한다. postingIds를 주면 그 공고만 본다.
 * 지원여부는 '' 그대로 두고 hiddenByRule만 채운다. 숨긴 건수를 돌려준다.
 */
export async function applyHideRules(db: DB, opts: { postingIds?: string[]; ruleIds?: number[] } = {}): Promise<number> {
  if (opts.postingIds && opts.postingIds.length === 0) return 0;
  const rules = await db.select().from(hideRules).where(opts.ruleIds ? inArray(hideRules.id, opts.ruleIds) : undefined);
  if (rules.length === 0) return 0;
  const rows = await db.select().from(postings).where(and(
    eq(postings.decision, ""), isNull(postings.hiddenByRule),
    opts.postingIds ? inArray(postings.id, opts.postingIds) : undefined,
  ));
  const byRule = new Map<number, string[]>();
  for (const p of rows) {
    const id = firstMatchingRule(rules, p);
    if (id !== null) byRule.set(id, [...(byRule.get(id) ?? []), p.id]);
  }
  let n = 0;
  for (const [ruleId, ids] of byRule) {
    for (let i = 0; i < ids.length; i += 200) {
      await db.update(postings).set({ hiddenByRule: ruleId }).where(inArray(postings.id, ids.slice(i, i + 200)));
    }
    n += ids.length;
  }
  return n;
}
