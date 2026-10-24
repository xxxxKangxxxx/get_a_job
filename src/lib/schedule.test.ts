import { describe, it, expect } from "vitest";
import { plan, DEFAULT_SETTINGS, type WorkItem } from "./schedule";
import { weekday } from "./date";

const today = "2026-10-26"; // 월요일
const opts = { today, settings: { ...DEFAULT_SETTINGS, weekdayHours: 3, weekendHours: 6 }, weekdayOf: weekday };
const app = (id: string, due: string, remaining: number, fit: WorkItem["fit"] = "A"): WorkItem =>
  ({ id, label: id, kind: "application", due, remaining, fit });

describe("plan", () => {
  it("같은 날 마감 5개를 앞 날짜들로 나눠 배분한다", () => {
    // 금요일(10/30) 마감 5개, 각 4시간, 하루 1일 전 완료 → 목요일까지 월~목 12시간
    const items = ["a", "b", "c", "d", "e"].map((id) => app(id, "2026-10-29", 4));
    const r = plan(items, opts);
    expect(r.days[0].used).toBe(3); // 오늘부터 바로 시작
    expect(r.atRisk.length).toBe(2); // 20시간 필요, 12시간뿐 → 2개는 위험
  });

  it("시간이 모자라면 적합도 낮은 공고를 포기 후보로 낸다", () => {
    const items = [app("a", "2026-10-28", 4, "A"), app("b", "2026-10-28", 4, "C"), app("c", "2026-10-28", 3, "B")];
    const r = plan(items, opts); // 월~수 9시간, 필요 11시간
    expect(r.atRisk.length).toBeGreaterThan(0);
    expect(r.dropSuggestions[0]).toBe("b");
  });

  it("A 적합도는 포기 후보로 내지 않는다", () => {
    const items = [app("a", "2026-10-26", 10, "A")];
    expect(plan(items, opts).dropSuggestions).toEqual([]);
  });

  it("면접 준비는 시작일 이전에 배분하지 않는다", () => {
    const prep: WorkItem = { id: "p", label: "면접", kind: "prep", start: "2026-10-29", due: "2026-10-30", remaining: 4, fit: "A" };
    const r = plan([prep], opts);
    expect(r.days.slice(0, 3).every((d) => d.used === 0)).toBe(true);
    expect(r.results.p.onTime).toBe(true);
  });

  it("날짜별 예외(일정 있는 날)는 가용 시간을 줄인다", () => {
    const s = { ...opts, settings: { ...opts.settings, overrides: { "2026-10-26": 0 } } };
    const r = plan([app("a", "2026-10-27", 3)], s);
    expect(r.days[0].used).toBe(0);
    expect(r.results.a.finishDate).toBe("2026-10-27");
  });
});
