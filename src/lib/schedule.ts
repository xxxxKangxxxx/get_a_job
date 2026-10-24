// 일정 계획 엔진.
// 남은 작업 시간을 하루 가용 시간 안에서 "마감 빠른 순(EDF)"으로 배분하고,
// 시간이 모자라면 놓칠 공고와 포기 후보를 알려 준다. 외부 API 없이 동작한다.
import { addDays, diffDays } from "./date";

export type Fit = "A" | "B" | "C" | "";

export type WorkItem = {
  id: string;
  label: string;
  kind: "application" | "prep";
  /** 이 날까지 끝내야 한다 (포함) */
  due: string;
  /** 이 날부터 작업할 수 있다 (면접 준비 등). 없으면 오늘부터 */
  start?: string;
  /** 남은 작업 시간 */
  remaining: number;
  fit: Fit;
  /** 마감 없는 수시 공고: 마감 있는 일보다 뒤로 밀린다 */
  soft?: boolean;
  meta?: Record<string, unknown>;
};

export type Settings = {
  weekdayHours: number;
  weekendHours: number;
  /** 마감 며칠 전까지 끝낼지 */
  bufferDays: number;
  /** 예상 시간을 모를 때 기본값 */
  defaultEstHours: number;
  /** 날짜별 예외 (예: 시험·약속으로 0시간) */
  overrides: Record<string, number>;
};

export const DEFAULT_SETTINGS: Settings = {
  weekdayHours: 3,
  weekendHours: 6,
  bufferDays: 1,
  defaultEstHours: 4,
  overrides: {},
};

export type Block = { itemId: string; hours: number };
export type DayPlan = { date: string; capacity: number; used: number; blocks: Block[] };
export type ItemResult = {
  id: string;
  finishDate: string | null;
  onTime: boolean;
  /** 마감까지 남는 여유 일수 (늦으면 음수, 못 끝내면 null) */
  slackDays: number | null;
  scheduledHours: number;
};
export type PlanResult = {
  days: DayPlan[];
  results: Record<string, ItemResult>;
  atRisk: string[];
  /** 포기하면 나머지를 제때 끝낼 수 있는 후보 (적합도 낮은 순) */
  dropSuggestions: string[];
  totalRemaining: number;
  totalCapacity: number;
};

const STEP = 0.5; // 30분 단위로 배분
const FIT_RANK: Record<string, number> = { A: 0, B: 1, C: 2, "": 3 };

export function capacityOf(date: string, s: Settings, weekdayOf: (d: string) => number): number {
  if (date in s.overrides) return s.overrides[date];
  const wd = weekdayOf(date);
  return wd === 0 || wd === 6 ? s.weekendHours : s.weekdayHours;
}

function roundStep(h: number) {
  return Math.round(h / STEP) * STEP;
}

export function simulate(
  items: WorkItem[],
  opts: { today: string; settings: Settings; weekdayOf: (d: string) => number; horizonDays?: number },
): Omit<PlanResult, "dropSuggestions"> {
  const { today, settings } = opts;
  const lastDue = items.reduce((m, it) => (it.due > m ? it.due : m), today);
  const horizon = Math.max(opts.horizonDays ?? 14, diffDays(today, lastDue) + 1);

  const left = new Map(items.map((it) => [it.id, roundStep(Math.max(0, it.remaining))]));
  const finish = new Map<string, string>();
  const scheduled = new Map<string, number>();
  for (const it of items) if (left.get(it.id) === 0) finish.set(it.id, today);

  // 마감 있는 일 → 마감 빠른 순 → 적합도 높은 순
  const order = [...items].sort((a, b) =>
    Number(!!a.soft) - Number(!!b.soft) || a.due.localeCompare(b.due) || FIT_RANK[a.fit] - FIT_RANK[b.fit],
  );

  const days: DayPlan[] = [];
  let totalCapacity = 0;
  for (let i = 0; i < horizon; i++) {
    const date = addDays(today, i);
    const capacity = capacityOf(date, settings, opts.weekdayOf);
    totalCapacity += capacity;
    let free = capacity;
    const blocks: Block[] = [];
    for (const it of order) {
      if (free < STEP) break;
      const rem = left.get(it.id)!;
      if (rem <= 0) continue;
      if (it.start && date < it.start) continue;
      if (!it.soft && date > it.due) continue; // 마감이 지난 일은 더 배분하지 않는다
      const h = Math.min(free, rem);
      blocks.push({ itemId: it.id, hours: h });
      free -= h;
      left.set(it.id, rem - h);
      scheduled.set(it.id, (scheduled.get(it.id) ?? 0) + h);
      if (rem - h <= 0) finish.set(it.id, date);
    }
    days.push({ date, capacity, used: capacity - free, blocks });
  }

  const results: Record<string, ItemResult> = {};
  const atRisk: string[] = [];
  for (const it of items) {
    const f = finish.get(it.id) ?? null;
    const onTime = f !== null && (it.soft || f <= it.due);
    results[it.id] = {
      id: it.id,
      finishDate: f,
      onTime,
      slackDays: f === null ? null : diffDays(f, it.due),
      scheduledHours: scheduled.get(it.id) ?? 0,
    };
    if (!onTime && !it.soft) atRisk.push(it.id);
  }
  const totalRemaining = items.reduce((s, it) => s + Math.max(0, it.remaining), 0);
  return { days, results, atRisk, totalRemaining, totalCapacity };
}

/** 계획을 세우고, 놓치는 일이 있으면 무엇을 포기하면 되는지까지 찾는다. */
export function plan(
  items: WorkItem[],
  opts: { today: string; settings: Settings; weekdayOf: (d: string) => number; horizonDays?: number },
): PlanResult {
  const base = simulate(items, opts);
  const dropSuggestions: string[] = [];
  if (base.atRisk.length > 0) {
    // 지원서만 포기 대상. 적합도 낮은 순, 같은 적합도면 남은 시간이 큰 것부터.
    const candidates = items
      .filter((it) => it.kind === "application" && !it.soft)
      .sort((a, b) => FIT_RANK[b.fit] - FIT_RANK[a.fit] || b.remaining - a.remaining);
    let rest = items;
    for (const c of candidates) {
      if (c.fit === "A") break; // A는 포기 후보로 내지 않는다
      const r = simulate(rest, opts);
      if (r.atRisk.length === 0) break;
      // 이 일을 빼서 다른 일이 살아날 때만 후보로 둔다
      const without = rest.filter((it) => it.id !== c.id);
      const r2 = simulate(without, opts);
      if (r2.atRisk.length < r.atRisk.filter((id) => id !== c.id).length + 1) {
        dropSuggestions.push(c.id);
        rest = without;
      }
    }
  }
  return { ...base, dropSuggestions };
}

/** 면접·인적성 등 일정 전에 확보할 준비 시간 */
export function prepFor(kind: string): { hours: number; daysBefore: number } | null {
  switch (kind) {
    case "면접": return { hours: 4, daysBefore: 3 };
    case "인적성": return { hours: 5, daysBefore: 5 };
    case "설명회": return null;
    default: return null;
  }
}
