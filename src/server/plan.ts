// DB에서 읽은 공고·일정·설정을 일정 엔진(src/lib/schedule.ts) 입력으로 바꾸고,
// 결과를 화면 약속 모양(TodayTask·DayLoad·Warning·InboxImpact)으로 돌려준다.
// DB를 직접 읽지 않는 순수 함수만 둔다 (테스트하기 쉽게).
import type {
  AppSettings, DayBlock, DayLoad, EventItem, Fit, Fix, InboxImpact, TodayTask, Warning,
} from "../contracts/types";
import { addDays, diffDays, formatShort, weekday } from "../lib/date";
import { plan, prepFor, simulate, type PlanResult, type WorkItem } from "../lib/schedule";

export type PlanPosting = {
  id: string;
  company: string;
  title: string;
  jobCategory: string;
  deadline: string | null;
  deadlineTime: string | null;
  rolling: boolean;
  fit: Fit;
  estHours: number | null;
  progress: number;
};

/** 일정 + 표시용 회사명·적합도 */
export type PlanEvent = EventItem & { company: string; fit: Fit };

export type BusyInput = { date: string; start: string | null; end: string | null; title: string };

export type PlanInput = {
  today: string;
  settings: AppSettings;
  /** decision = "예정" 공고 */
  postings: PlanPosting[];
  /** 오늘 이후 일정 (준비 시간 계산 + 날짜별 표시) */
  events: PlanEvent[];
  busy: BusyInput[];
  /** 일정 id → 이미 체크한 준비 시간 합 */
  donePrepHours?: Record<number, number>;
  /** 오늘 체크한 할 일 (id → 체크 당시 모습) */
  checkedToday?: Record<string, TodayTask>;
};

type ItemInfo = {
  kind: "application" | "prep";
  company: string;
  label: string;
  fit: Fit;
  postingId: string | null;
  applicationId: string | null;
  /** 실제 마감일(지원서) 또는 전형 일정일. 수시는 null */
  dueDate: string | null;
  dueTime: string | null;
  est: number;
  progress: number;
};

export type DayCap = { base: number; busyHours: number; capacity: number; busy: BusyInput[] };

export type PlanContext = {
  input: PlanInput;
  items: WorkItem[];
  info: Map<string, ItemInfo>;
  horizon: number;
  caps: Map<string, DayCap>;
};

const SOFT_DAYS = 27; // 수시 공고는 4주 안에 끝내는 것으로 친다
const MAX_DAY_HOURS = 12; // 시간 늘리기 제안의 하루 상한
const STEP = 0.5;

const roundStep = (h: number) => Math.round(h / STEP) * STEP;
const ceilStep = (h: number) => Math.ceil(h / STEP - 1e-9) * STEP;
const md = (d: string) => { const [, m, day] = d.split("-").map(Number); return `${m}/${day}`; };

export const appItemId = (postingId: string) => `a:${postingId}`;
export const prepItemId = (eventId: number) => `p:${eventId}`;
export const taskId = (date: string, itemId: string) => `${date}:${itemId}`;

/** 설정상 기본 가용 시간 (예외 설정 반영, 캘린더 일정은 빼기 전) */
export function baseHoursOf(date: string, s: AppSettings): number {
  if (date in s.overrides) return s.overrides[date];
  const wd = weekday(date);
  return wd === 0 || wd === 6 ? s.weekendHours : s.weekdayHours;
}

function toMin(t: string) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }

/** 캘린더 일정 하나가 차지하는 시간. 시각이 없으면 종일 → null */
function busyHoursOf(b: BusyInput): number | null {
  if (!b.start || !b.end) return null;
  return Math.max(0, toMin(b.end) - toMin(b.start)) / 60;
}

export function dayCaps(today: string, days: number, s: AppSettings, busy: BusyInput[]): Map<string, DayCap> {
  const byDate = new Map<string, BusyInput[]>();
  for (const b of busy) byDate.set(b.date, [...(byDate.get(b.date) ?? []), b]);
  const out = new Map<string, DayCap>();
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    const base = baseHoursOf(date, s);
    const list = byDate.get(date) ?? [];
    let busyHours = 0;
    for (const b of list) busyHours += busyHoursOf(b) ?? base;
    busyHours = Math.min(base, roundStep(busyHours));
    out.set(date, { base, busyHours, capacity: Math.max(0, base - busyHours), busy: list });
  }
  return out;
}

/** 일정 제목에서 회사명을 떼고 "~ 준비"로 만든다. 예: "현대무벡스 1차면접" → "1차면접 준비" */
function prepLabel(e: PlanEvent): string {
  let t = e.title.trim();
  if (e.company && t.startsWith(e.company)) t = t.slice(e.company.length).trim();
  return `${t || e.kind} 준비`;
}

export function buildContext(input: PlanInput, horizonDays = 14): PlanContext {
  const { today, settings: s } = input;
  const checked = input.checkedToday ?? {};
  const tomorrow = addDays(today, 1);
  const items: WorkItem[] = [];
  const info = new Map<string, ItemInfo>();

  for (const p of input.postings) {
    if (p.deadline && p.deadline < today) continue; // 마감 지난 것 제외
    const est = p.estHours ?? s.defaultEstHours;
    const progress = Math.min(100, Math.max(0, p.progress));
    const remaining = est * (1 - progress / 100);
    if (remaining <= 0) continue;
    const soft = !p.deadline || p.rolling;
    const due = soft ? addDays(today, SOFT_DAYS) : maxDate(today, addDays(p.deadline!, -s.bufferDays));
    const id = appItemId(p.id);
    items.push({ id, label: p.jobCategory || p.title, kind: "application", due, remaining, fit: p.fit, soft });
    info.set(id, {
      kind: "application", company: p.company, label: p.jobCategory || p.title, fit: p.fit,
      postingId: p.id, applicationId: null, dueDate: soft ? null : p.deadline, dueTime: p.deadlineTime, est, progress,
    });
  }

  for (const e of input.events) {
    if (e.done || e.date < today) continue;
    const prep = prepFor(e.kind);
    if (!prep) continue;
    const remaining = prep.hours - (input.donePrepHours?.[e.id] ?? 0);
    if (remaining <= 0) continue;
    const start = addDays(e.date, -prep.daysBefore);
    const due = e.date > today ? addDays(e.date, -1) : e.date;
    const id = prepItemId(e.id);
    items.push({ id, label: prepLabel(e), kind: "prep", due, start: start > today ? start : undefined, remaining, fit: e.fit });
    info.set(id, {
      kind: "prep", company: e.company, label: prepLabel(e), fit: e.fit, postingId: e.postingId,
      applicationId: e.applicationId, dueDate: e.date, dueTime: e.time, est: prep.hours, progress: 0,
    });
  }

  // 오늘 이미 체크한 항목은 오늘 더 배분하지 않는다
  for (const it of items) {
    if (checked[taskId(today, it.id)] && (!it.start || it.start < tomorrow)) it.start = tomorrow;
  }

  const lastDue = items.reduce((m, it) => (it.due > m ? it.due : m), today);
  const horizon = Math.max(horizonDays, diffDays(today, lastDue) + 1);
  const caps = dayCaps(today, horizon, s, input.busy);
  // 오늘 체크한 시간만큼 오늘 남은 시간을 줄인다
  const doneToday = Object.values(checked).reduce((sum, t) => sum + t.hours, 0);
  const c0 = caps.get(today)!;
  caps.set(today, { ...c0, capacity: Math.max(0, c0.capacity - doneToday) });

  return { input, items, info, horizon, caps };
}

function maxDate(a: string, b: string) { return a > b ? a : b; }

function engineOpts(ctx: PlanContext, capOverride?: Record<string, number>) {
  const overrides: Record<string, number> = {};
  for (const [d, c] of ctx.caps) overrides[d] = c.capacity;
  Object.assign(overrides, capOverride);
  return {
    today: ctx.input.today,
    settings: { ...ctx.input.settings, overrides },
    weekdayOf: weekday,
    horizonDays: ctx.horizon,
  };
}

export function runPlan(ctx: PlanContext): PlanResult {
  return plan(ctx.items, engineOpts(ctx));
}

// ---------------- 변환 ----------------

export function toTodayTasks(ctx: PlanContext, result: PlanResult): TodayTask[] {
  const { today } = ctx.input;
  const day = result.days[0];
  const fresh: TodayTask[] = day.blocks.map((b) => {
    const inf = ctx.info.get(b.itemId)!;
    const finishes = result.results[b.itemId]?.finishDate === today;
    const isApp = inf.kind === "application";
    return {
      id: taskId(today, b.itemId),
      kind: inf.kind,
      postingId: inf.postingId,
      applicationId: inf.applicationId,
      company: inf.company,
      label: inf.label,
      hours: b.hours,
      progressFrom: isApp ? inf.progress : null,
      progressTo: isApp ? (finishes ? 100 : Math.min(100, Math.round(inf.progress + (b.hours / inf.est) * 100))) : null,
      dueDate: inf.dueDate,
      dueTime: inf.dueTime,
      dday: inf.dueDate ? diffDays(today, inf.dueDate) : null,
      fit: inf.fit,
      done: false,
    };
  });
  const done = Object.values(ctx.input.checkedToday ?? {}).map((t) => ({ ...t, done: true }));
  return [...fresh, ...done];
}

function atRiskWindowEnd(ctx: PlanContext, result: PlanResult): string | null {
  let end: string | null = null;
  for (const id of result.atRisk) {
    const due = ctx.items.find((it) => it.id === id)!.due;
    if (!end || due > end) end = due;
  }
  return end;
}

export function toDayLoads(ctx: PlanContext, result: PlanResult, days: number): DayLoad[] {
  const riskEnd = atRiskWindowEnd(ctx, result);
  const out: DayLoad[] = [];
  for (const d of result.days.slice(0, days)) {
    const cap = ctx.caps.get(d.date)!;
    const blocks: DayBlock[] = d.blocks.map((b) => {
      const inf = ctx.info.get(b.itemId)!;
      return {
        itemId: b.itemId, kind: inf.kind, company: inf.company, label: inf.label, hours: b.hours,
        finishes: result.results[b.itemId]?.finishDate === d.date,
      };
    });
    out.push({
      date: d.date,
      baseHours: cap.base,
      busyHours: cap.busyHours,
      capacity: d.capacity,
      used: d.used,
      blocks,
      deadlines: ctx.input.postings.filter((p) => p.deadline === d.date)
        .map((p) => ({ postingId: p.id, company: p.company, label: p.jobCategory || p.title, fit: p.fit })),
      events: ctx.input.events.filter((e) => e.date === d.date).map(stripEvent),
      busy: cap.busy.map((b) => ({ title: b.title, start: b.start, end: b.end })),
      overloaded: d.capacity > 0 && d.used >= d.capacity && riskEnd !== null && d.date <= riskEnd,
    });
  }
  return out;
}

function stripEvent(e: PlanEvent): EventItem {
  return { id: e.id, kind: e.kind, title: e.title, date: e.date, time: e.time, postingId: e.postingId, applicationId: e.applicationId, done: e.done };
}

/** 지원서는 마감일, 준비는 전형 일정일 */
function groupDateOf(ctx: PlanContext, itemId: string): string {
  const inf = ctx.info.get(itemId)!;
  return inf.dueDate ?? ctx.items.find((it) => it.id === itemId)!.due;
}

function riskEntry(ctx: PlanContext, id: string) {
  const inf = ctx.info.get(id)!;
  return { postingId: inf.postingId ?? inf.applicationId ?? "", company: inf.company, label: inf.label, fit: inf.fit };
}

/** 각 일이 자기 마감(due) 안에 배분받은 시간 */
function scheduledByDue(ctx: PlanContext, result: PlanResult): Map<string, number> {
  const due = new Map(ctx.items.map((it) => [it.id, it.due]));
  const m = new Map<string, number>();
  for (const d of result.days) for (const b of d.blocks) {
    if (d.date <= due.get(b.itemId)!) m.set(b.itemId, (m.get(b.itemId) ?? 0) + b.hours);
  }
  return m;
}

export function toWarnings(ctx: PlanContext, result: PlanResult): Warning[] {
  if (result.atRisk.length === 0) return [];
  const { today } = ctx.input;
  const groups = new Map<string, string[]>();
  for (const id of result.atRisk) {
    const g = groupDateOf(ctx, id);
    groups.set(g, [...(groups.get(g) ?? []), id]);
  }
  const itemById = new Map(ctx.items.map((it) => [it.id, it]));
  const sched = scheduledByDue(ctx, result);
  const opts = engineOpts(ctx);
  const warnings: Warning[] = [];

  for (const [date, riskIds] of [...groups].sort((a, b) => a[0].localeCompare(b[0]))) {
    const cut = riskIds.reduce((m, id) => maxDate(m, itemById.get(id)!.due), today);
    const competing = ctx.items.filter((it) => !it.soft && it.due <= cut);
    const neededHours = roundStep(competing.reduce((s, it) => s + it.remaining, 0));
    let availableHours = 0;
    for (const d of result.days) if (d.date <= cut) availableHours += d.capacity;
    const sameDay = ctx.items.filter((it) => !it.soft && groupDateOf(ctx, it.id) === date);
    const appCount = sameDay.filter((it) => it.kind === "application").length;
    const title = appCount > 0
      ? `${formatShort(date)} 마감 ${appCount}건이 몰려 있어요`
      : `${formatShort(date)} 일정 준비 시간이 모자라요`;
    const message = neededHours > availableHours
      ? `${neededHours}시간이 필요한데 그 전까지 ${availableHours}시간만 쓸 수 있어요`
      : `${neededHours}시간이 필요한데 앞선 마감과 겹쳐 제때 끝내기 어려워요`;
    const groupRisk = (r: { atRisk: string[] }) => r.atRisk.filter((id) => groupDateOf(ctx, id) === date);

    const fixes: Fix[] = [];
    // 포기 후보
    for (const dropId of result.dropSuggestions) {
      const rest = ctx.items.filter((it) => it.id !== dropId);
      const after = groupRisk(simulate(rest, opts));
      const before = riskIds.filter((id) => id !== dropId);
      if (!riskIds.includes(dropId) && after.length >= before.length) continue;
      const inf = ctx.info.get(dropId)!;
      const others = sameDay.filter((it) => it.id !== dropId).length;
      fixes.push({
        id: `drop:${inf.postingId}`,
        kind: "drop",
        label: `${inf.company} ${inf.label}(${inf.fit || "-"}) 포기하기`,
        detail: after.length === 0
          ? (others > 0 ? `나머지 ${others}건은 제때 끝나요` : "다른 공고는 제때 끝나요")
          : `그래도 ${after.length}건은 늦어요`,
        postingId: inf.postingId!,
      });
    }
    // 특정 날 시간 늘리기
    const shortfall = ceilStep(riskIds.reduce((s, id) => s + Math.max(0, itemById.get(id)!.remaining - (sched.get(id) ?? 0)), 0));
    const candidates = result.days.filter((d) => d.date <= cut)
      .sort((a, b) => Number(isWeekend(b.date)) - Number(isWeekend(a.date)) || a.date.localeCompare(b.date));
    let added = 0;
    for (const d of candidates) {
      if (added >= 2 || shortfall <= 0) break;
      const cap = ctx.caps.get(d.date)!;
      const add = Math.min(shortfall, MAX_DAY_HOURS - cap.base);
      if (add < STEP) continue;
      const after = groupRisk(simulate(ctx.items, engineOpts(ctx, { [d.date]: d.capacity + add })));
      if (after.length >= riskIds.length) continue;
      fixes.push({
        id: `addHours:${d.date}:${add}`,
        kind: "addHours",
        label: `${formatShort(d.date)} ${add}시간 더 쓰기`,
        detail: after.length === 0
          ? `${sameDay.length}건 모두 끝나요 · ${formatShort(d.date)} ${cap.base + add}시간`
          : `${after.length}건은 여전히 늦어요 · ${formatShort(d.date)} ${cap.base + add}시간`,
        date: d.date,
        hours: add,
      });
      added++;
    }

    warnings.push({
      id: `overload:${date}`,
      kind: "overload",
      date,
      title,
      message,
      neededHours,
      availableHours,
      atRisk: riskIds.map((id) => riskEntry(ctx, id)),
      fixes,
    });
  }
  return warnings;
}

function isWeekend(d: string) { const w = weekday(d); return w === 0 || w === 6; }

/** 이 공고를 "예정"으로 넣고 다시 계산했을 때의 영향 */
export function inboxImpact(ctx: PlanContext, base: PlanResult, p: PlanPosting): InboxImpact {
  const { today, settings: s } = ctx.input;
  const est = p.estHours ?? s.defaultEstHours;
  const remaining = est * (1 - Math.min(100, Math.max(0, p.progress)) / 100);
  const soft = !p.deadline || p.rolling;
  const id = appItemId(p.id);
  const item: WorkItem = {
    id, label: p.jobCategory || p.title, kind: "application", remaining, fit: p.fit, soft,
    due: soft ? addDays(today, SOFT_DAYS) : maxDate(today, addDays(p.deadline!, -s.bufferDays)),
  };
  const items = [...ctx.items.filter((it) => it.id !== id), item];
  const lastDue = items.reduce((m, it) => (it.due > m ? it.due : m), today);
  const opts = engineOpts(ctx);
  // 새 공고 마감이 계획 범위보다 뒤면 그만큼 늘린다 (늘어난 날은 설정 기본값)
  const extra = diffDays(today, lastDue) + 1 - ctx.horizon;
  if (extra > 0) {
    const more = dayCaps(today, ctx.horizon + extra, s, ctx.input.busy);
    for (const [d, c] of more) if (!(d in opts.settings.overrides)) opts.settings.overrides[d] = c.capacity;
    opts.horizonDays = ctx.horizon + extra;
  }
  const r = simulate(items, opts);
  const before = new Set(base.atRisk);
  const newRisk = r.atRisk.filter((x) => x !== id && !before.has(x));
  const days = r.days.filter((d) => d.blocks.some((b) => b.itemId === id)).map((d) => d.date);
  const selfOk = r.results[id]?.onTime ?? false;
  const fits = selfOk && newRisk.length === 0;

  const dayWord = (d: string) => (d === today ? "오늘" : d === addDays(today, 1) ? "내일" : `${md(d)}에`);
  let message: string;
  if (!selfOk) {
    message = `마감 전까지 ${roundStep(remaining)}시간을 낼 수 없어요`;
  } else if (newRisk.length > 0) {
    const first = newRisk.map((x) => groupDateOf(ctx, x)).sort()[0];
    const n = newRisk.filter((x) => groupDateOf(ctx, x) === first).length;
    message = `지원하면 ${md(first)} 마감 공고 ${n}건을 놓칠 수 있어요`;
  } else if (days.length === 0) {
    message = "바로 끝낼 수 있어요";
  } else if (days.length === 1) {
    message = `${dayWord(days[0])} 끝내면 다른 공고와 겹치지 않아요`;
  } else {
    message = `${md(days[0])}~${md(days[days.length - 1])}에 나눠 쓰면 다른 공고와 겹치지 않아요`;
  }
  return { estHours: est, fits, days, message };
}
