import { describe, it, expect } from "vitest";
import { buildContext, inboxImpact, runPlan, toDayLoads, toTodayTasks, toWarnings, type PlanInput, type PlanPosting, type PlanEvent } from "./plan";
import { DEFAULT_APP_SETTINGS } from "./settings";

const today = "2026-10-26"; // 월요일
const post = (id: string, deadline: string | null, o: Partial<PlanPosting> = {}): PlanPosting => ({
  id, company: id, title: `${id} 공고`, jobCategory: "구매", deadline, deadlineTime: null, rolling: false,
  fit: "A", estHours: 4, progress: 0, ...o,
});
const input = (o: Partial<PlanInput> = {}): PlanInput => ({
  today, settings: { ...DEFAULT_APP_SETTINGS }, postings: [], events: [], busy: [], ...o,
});

describe("buildContext — 공고·일정을 작업 항목으로", () => {
  it("남은 시간 = 예상 × (1 − 진행률), 마감 − 여유일, 지난 마감 제외, 수시는 soft", () => {
    const ctx = buildContext(input({
      postings: [
        post("a", "2026-10-30", { estHours: 5, progress: 40 }),
        post("b", "2026-10-20"), // 지남
        post("c", null, { rolling: true, estHours: null }),
        post("d", "2026-10-29", { progress: 100 }), // 끝남
      ],
    }));
    const a = ctx.items.find((x) => x.id === "a:a")!;
    expect(a.remaining).toBeCloseTo(3);
    expect(a.due).toBe("2026-10-29");
    expect(ctx.items.find((x) => x.id === "a:b")).toBeUndefined();
    expect(ctx.items.find((x) => x.id === "a:d")).toBeUndefined();
    const c = ctx.items.find((x) => x.id === "a:c")!;
    expect(c.soft).toBe(true);
    expect(c.remaining).toBe(4); // 기본 예상 시간
  });

  it("면접은 3일 전부터 4시간, 인적성은 5일 전부터 5시간 (전날까지)", () => {
    const ev = (id: number, kind: PlanEvent["kind"], date: string): PlanEvent =>
      ({ id, kind, title: `회사 ${kind}`, date, time: "14:00", postingId: null, applicationId: "x", done: false, company: "회사", fit: "A" });
    const ctx = buildContext(input({ events: [ev(1, "면접", "2026-11-02"), ev(2, "인적성", "2026-10-28"), ev(3, "설명회", "2026-10-28")], donePrepHours: { 2: 1 } }));
    const p1 = ctx.items.find((x) => x.id === "p:1")!;
    expect(p1).toMatchObject({ kind: "prep", start: "2026-10-30", due: "2026-11-01", remaining: 4, label: "면접 준비" });
    const p2 = ctx.items.find((x) => x.id === "p:2")!;
    expect(p2.start).toBeUndefined(); // 이미 준비 기간 안
    expect(p2.remaining).toBe(4); // 5시간 − 체크한 1시간
    expect(ctx.items.find((x) => x.id === "p:3")).toBeUndefined();
  });

  it("가용 시간 = 설정(평일/주말/예외) − 캘린더 일정", () => {
    const ctx = buildContext(input({
      settings: { ...DEFAULT_APP_SETTINGS, overrides: { "2026-10-27": 5 } },
      busy: [
        { date: "2026-10-26", start: "19:00", end: "20:30", title: "약속" },
        { date: "2026-10-27", start: "10:00", end: "12:00", title: "병원" },
        { date: "2026-10-31", start: null, end: null, title: "여행" }, // 종일
      ],
    }));
    expect(ctx.caps.get("2026-10-26")).toMatchObject({ base: 3, busyHours: 1.5, capacity: 1.5 });
    expect(ctx.caps.get("2026-10-27")).toMatchObject({ base: 5, busyHours: 2, capacity: 3 });
    expect(ctx.caps.get("2026-10-31")).toMatchObject({ base: 6, busyHours: 6, capacity: 0 });
    expect(ctx.caps.get("2026-11-01")!.capacity).toBe(6);
  });
});

describe("오늘 할 일", () => {
  it("progressTo = 진행률 + 오늘 시간/예상 시간 × 100", () => {
    const ctx = buildContext(input({ postings: [post("a", "2026-11-05", { estHours: 6, progress: 10 })] }));
    const [t] = toTodayTasks(ctx, runPlan(ctx));
    expect(t).toMatchObject({ id: "2026-10-26:a:a", hours: 3, progressFrom: 10, progressTo: 60, dday: 10, done: false });
  });

  it("끝나는 날이면 progressTo = 100", () => {
    const ctx = buildContext(input({ postings: [post("a", "2026-11-05", { estHours: 4, progress: 50 })] }));
    expect(toTodayTasks(ctx, runPlan(ctx))[0].progressTo).toBe(100);
  });

  it("오늘 체크한 일은 done으로 남고, 그 시간만큼 오늘 시간이 줄어든다", () => {
    const checked = {
      "2026-10-26:a:a": { id: "2026-10-26:a:a", kind: "application" as const, postingId: "a", applicationId: null, company: "a", label: "구매", hours: 2, progressFrom: 0, progressTo: 50, dueDate: "2026-11-05", dueTime: null, dday: 10, fit: "A" as const, done: true },
    };
    const ctx = buildContext(input({
      postings: [post("a", "2026-11-05", { progress: 50 }), post("b", "2026-11-06")],
      checkedToday: checked,
    }));
    const tasks = toTodayTasks(ctx, runPlan(ctx));
    expect(tasks.find((t) => t.id === "2026-10-26:a:a")?.done).toBe(true);
    const fresh = tasks.filter((t) => !t.done);
    expect(fresh.map((t) => t.postingId)).toEqual(["b"]); // a는 오늘 더 배분하지 않음
    expect(fresh[0].hours).toBe(1); // 3시간 − 체크한 2시간
  });
});

describe("경고", () => {
  it("몰린 마감일별로 묶고, 포기 후보(C)와 시간 늘리기를 제안한다", () => {
    // 수(10/28) 마감 3건 × 4시간, 화요일까지 월·화 6시간
    const ctx = buildContext(input({
      postings: [post("a", "2026-10-28", { fit: "A" }), post("b", "2026-10-28", { fit: "C" }), post("c", "2026-10-28", { fit: "B" })],
    }));
    const r = runPlan(ctx);
    const ws = toWarnings(ctx, r);
    expect(ws).toHaveLength(1);
    const w = ws[0];
    expect(w).toMatchObject({ id: "overload:2026-10-28", date: "2026-10-28", neededHours: 12, availableHours: 6 });
    expect(w.title).toBe("10/28(수) 마감 3건이 몰려 있어요");
    const drops = w.fixes.filter((f) => f.kind === "drop");
    expect(drops[0].postingId).toBe("b"); // 적합도 낮은 C 먼저
    expect(drops.some((f) => f.postingId === "a")).toBe(false); // A는 포기 후보 아님
    expect(w.fixes.some((f) => f.kind === "addHours")).toBe(true);
    const days = toDayLoads(ctx, r, 7);
    expect(days[0].overloaded).toBe(true);
    expect(days[2].deadlines).toHaveLength(3);
  });

  it("시간이 충분하면 경고가 없다", () => {
    const ctx = buildContext(input({ postings: [post("a", "2026-11-10")] }));
    expect(toWarnings(ctx, runPlan(ctx))).toEqual([]);
  });
});

describe("받은편지함 영향", () => {
  it("여유가 있으면 fits=true, 배치될 날짜를 알려 준다", () => {
    const ctx = buildContext(input({ postings: [post("a", "2026-11-10")] }));
    const imp = inboxImpact(ctx, runPlan(ctx), post("new", "2026-11-12", { fit: "B" }));
    expect(imp.fits).toBe(true);
    expect(imp.days.length).toBeGreaterThan(0);
    expect(imp.estHours).toBe(4);
  });

  it("넣으면 기존 공고가 새로 위험해지면 fits=false", () => {
    // 화(10/27) 마감 a: 월요일 3시간 + 오늘 마감 아님. 새 공고가 더 빨리 마감이면 a를 밀어낸다
    const ctx = buildContext(input({ postings: [post("a", "2026-10-28", { estHours: 6 })] }));
    const base = runPlan(ctx);
    expect(base.atRisk).toEqual([]);
    const imp = inboxImpact(ctx, base, post("new", "2026-10-27", { estHours: 3 }));
    expect(imp.fits).toBe(false);
    expect(imp.message).toContain("10/28 마감 공고 1건");
  });

  it("마감 전까지 시간이 안 되면 fits=false", () => {
    const ctx = buildContext(input());
    const imp = inboxImpact(ctx, runPlan(ctx), post("new", "2026-10-27", { estHours: 10 }));
    expect(imp.fits).toBe(false);
    expect(imp.message).toContain("낼 수 없어요");
  });
});
