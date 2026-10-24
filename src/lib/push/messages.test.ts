import { describe, expect, it } from "vitest";
import { briefing, decisionPrompts } from "./messages";
import type { InboxView, TodayView } from "../../contracts/types";

describe("messages", () => {
  it("아침 브리핑에 할 일·일정·경고를 담는다", () => {
    const t = {
      date: "2026-10-24", baseHours: 6, busyHours: 2, availableHours: 4, counts: { inbox: 3, needDecision: 1 },
      calendar: { connected: true, lastSyncAt: null },
      tasks: [{ id: "1", company: "효성", label: "지원서", hours: 2, done: false }, { id: "2", company: "LG", label: "지원서", hours: 2, done: true }],
      warnings: [{ title: "10/31(금) 마감 3건이 몰려 있어요" }],
      week: [{ date: "2026-10-24", events: [{ title: "삼성 1차면접", time: "10:00", done: false }], deadlines: [{ company: "CJ" }] }],
    } as unknown as TodayView;
    const p = briefing(t);
    expect(p.body).toContain("할 일 1개 (4시간): 효성 지원서 2h");
    expect(p.body).toContain("오늘 일정: 10:00 삼성 1차면접");
    expect(p.body).toContain("오늘 마감: CJ");
    expect(p.body).toContain("⚠️ 10/31(금) 마감 3건이 몰려 있어요");
    expect(p.tag).toBe("briefing-2026-10-24");
  });
  it("미결정 A급만 버튼 달린 알림으로", () => {
    const inbox = { cards: [
      { id: "a", company: "A사", title: "구매", dday: 5, reason: "needDecision", impact: { message: "넣어도 괜찮아요" } },
      { id: "b", company: "B사", title: "영업", dday: 9, reason: "new", impact: { message: "" } },
    ] } as unknown as InboxView;
    const ps = decisionPrompts(inbox);
    expect(ps).toHaveLength(1);
    expect(ps[0]).toMatchObject({ title: "지원할까요? A사 · D-5", postingId: "a", actions: [{ action: "apply" }, { action: "skip" }] });
  });
});
