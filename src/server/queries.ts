// 화면이 데이터를 읽을 때 부르는 함수들 (서버 컴포넌트에서 await 해서 사용).
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import type {
  TodayView, ScheduleView, InboxView, BoardView, PostingFilter, PostingSummary, PostingDetail,
  AppSettings, HideRule, DismissReasonKind, ApplicationCard,
} from "../contracts/types";
import { db } from "../db";
import { applications, events, hideRules, postings } from "../db/schema";
import { todayKST } from "../lib/date";
import {
  COLUMNS, loadCalendarStatus, loadInboxRows, loadNextEvents, loadPlanInput, loadSettings, loadSourceMeta,
  toApplicationCard, toEventItem, toPlanPosting, toSummary,
} from "./data";
import { buildContext, inboxImpact, runPlan, toDayLoads, toTodayTasks, toWarnings } from "./plan";

export async function getToday(): Promise<TodayView> {
  const today = todayKST();
  const input = await loadPlanInput(db, today);
  const ctx = buildContext(input, 14);
  const result = runPlan(ctx);
  const cap = ctx.caps.get(today)!;
  const inbox = await loadInboxRows(db, today);
  return {
    date: today,
    baseHours: cap.base,
    busyHours: cap.busyHours,
    availableHours: cap.base - cap.busyHours,
    tasks: toTodayTasks(ctx, result),
    warnings: toWarnings(ctx, result),
    week: toDayLoads(ctx, result, 7),
    counts: { inbox: inbox.cards.length, needDecision: inbox.counts.needDecision },
    calendar: await loadCalendarStatus(db),
  };
}

/** days: 오늘부터 며칠치 (기본 14) */
export async function getSchedule(days = 14): Promise<ScheduleView> {
  const today = todayKST();
  const n = Math.max(1, Math.min(90, Math.floor(days)));
  const ctx = buildContext(await loadPlanInput(db, today), n);
  const result = runPlan(ctx);
  return {
    today,
    days: toDayLoads(ctx, result, n),
    warnings: toWarnings(ctx, result),
    calendar: await loadCalendarStatus(db),
  };
}

export async function getInbox(): Promise<InboxView> {
  const today = todayKST();
  const { cards, counts } = await loadInboxRows(db, today);
  const ctx = buildContext(await loadPlanInput(db, today), 14);
  const base = runPlan(ctx);
  return {
    cards: cards.map(({ row, reason }) => ({
      ...toSummary(row, today),
      reason,
      impact: inboxImpact(ctx, base, toPlanPosting(row)),
    })),
    counts,
  };
}

export async function getBoard(): Promise<BoardView> {
  const today = todayKST();
  const srcMeta = await loadSourceMeta(db);
  const colMap = srcMeta.전형칼럼 ?? {};
  const [apps, planned, next] = await Promise.all([
    db.select().from(applications).orderBy(desc(applications.appliedAt)),
    db.select().from(postings).where(eq(postings.decision, "예정")).orderBy(asc(postings.deadline)),
    loadNextEvents(db, today),
  ]);
  const preparing: ApplicationCard[] = planned
    .filter((p) => !p.deadline || p.deadline >= today)
    .map((p) => ({
      id: p.id, postingId: p.id, company: p.company, title: p.title, jobCategory: p.jobCategory, appliedAt: null,
      stage: "준비 중", column: "준비 중", nextEvent: null, progress: p.progress, deadline: p.deadline, historyNote: "", url: p.url,
    }));
  const cards = apps.map((a) => toApplicationCard(a, colMap, next.get(a.id) ?? null));
  return {
    columns: COLUMNS.map((key) => ({ key, cards: key === "준비 중" ? preparing : cards.filter((c) => c.column === key) })),
    totals: {
      applied: apps.length,
      active: apps.filter((a) => !["최종 합격", "불합격", "불참·포기"].includes(a.stage)).length,
      finalPass: apps.filter((a) => a.stage === "최종 합격").length,
    },
    stages: srcMeta.전형단계 ?? [],
  };
}

export async function listPostings(filter: PostingFilter = {}): Promise<{ items: PostingSummary[]; total: number }> {
  const today = todayKST();
  const where: SQL[] = [];
  const q = filter.q?.trim();
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    where.push(or(ilike(postings.company, like), ilike(postings.title, like), ilike(postings.jobCategory, like))!);
  }
  if (filter.fit?.length) where.push(inArray(postings.fit, filter.fit));
  const status = filter.status ?? "진행중";
  if (status !== "all") where.push(eq(postings.status, status));
  if (filter.decision?.length) where.push(inArray(postings.decision, filter.decision));
  if (filter.companyType?.length) where.push(inArray(postings.companyType, filter.companyType));
  if (filter.employmentType?.length) where.push(inArray(postings.employmentType, filter.employmentType));
  const cond = where.length ? and(...where) : undefined;

  const deadlineAsc = sql`${postings.deadline} asc nulls last`;
  const fitRank = sql`case ${postings.fit} when 'A' then 0 when 'B' then 1 when 'C' then 2 else 3 end`;
  const order = filter.sort === "fit" ? [fitRank, deadlineAsc]
    : filter.sort === "recent" ? [sql`${postings.surveyedAt} desc nulls last`, desc(postings.createdAt)]
    : [deadlineAsc, fitRank];
  const limit = Math.max(1, Math.min(500, filter.limit ?? 50));
  const offset = Math.max(0, filter.offset ?? 0);

  const [rows, [{ n }]] = await Promise.all([
    db.select().from(postings).where(cond).orderBy(...order, asc(postings.id)).limit(limit).offset(offset),
    db.select({ n: sql<number>`count(*)::int` }).from(postings).where(cond),
  ]);
  return { items: rows.map((r) => toSummary(r, today)), total: n };
}

export async function getPosting(id: string): Promise<PostingDetail | null> {
  const today = todayKST();
  const [p] = await db.select().from(postings).where(eq(postings.id, id));
  if (!p) return null;
  const [app] = await db.select().from(applications).where(or(eq(applications.postingId, id), eq(applications.id, id)));
  const evRows = await db.select().from(events)
    .where(or(eq(events.postingId, id), app ? eq(events.applicationId, app.id) : sql`false`))
    .orderBy(asc(events.date), asc(events.time));
  let application: ApplicationCard | null = null;
  if (app) {
    const colMap = (await loadSourceMeta(db)).전형칼럼 ?? {};
    const next = await loadNextEvents(db, today, [app.id]);
    application = toApplicationCard(app, colMap, next.get(app.id) ?? null);
  }
  return {
    ...toSummary(p, today),
    companyTypeBasis: p.companyTypeBasis,
    surveyedAt: p.surveyedAt,
    events: evRows.map(toEventItem),
    application,
  };
}

export async function getSettings(): Promise<AppSettings> {
  return loadSettings(db);
}

export async function listHideRules(): Promise<HideRule[]> {
  const rows = await db.select({
    id: hideRules.id, kind: hideRules.kind, value: hideRules.value, createdAt: hideRules.createdAt,
    hiddenCount: sql<number>`(select count(*)::int from postings p where p.hidden_by_rule = "hide_rules"."id")`,
  }).from(hideRules).orderBy(desc(hideRules.createdAt));
  return rows.map((r) => ({
    id: r.id, kind: r.kind as DismissReasonKind, value: r.value, hiddenCount: r.hiddenCount,
    createdAt: r.createdAt.toISOString(),
  }));
}
