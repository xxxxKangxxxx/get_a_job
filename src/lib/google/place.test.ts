import { describe, expect, it } from "vitest";
import { buildDesired, placeDay, splitBusy } from "./place";
import type { DayLoad, PostingSummary } from "../../contracts/types";

const WINDOW = { weekday: { start: "19:00", end: "23:00" }, weekend: { start: "10:00", end: "18:00" } };
const block = (itemId: string, hours: number) => ({ itemId, kind: "application" as const, company: itemId, label: "지원서", hours, finishes: false });

describe("splitBusy", () => {
  it("UTC 구간을 한국 날짜·시각으로 바꾸고 자정을 넘기면 나눈다", () => {
    expect(splitBusy([{ start: "2026-10-27T05:00:00Z", end: "2026-10-27T07:30:00Z" }])).toEqual([
      { date: "2026-10-27", start: "14:00", end: "16:30", title: "개인 일정", source: "google" },
    ]);
    expect(splitBusy([{ start: "2026-10-27T13:00:00Z", end: "2026-10-27T16:00:00Z" }])).toEqual([
      { date: "2026-10-27", start: "22:00", end: "24:00", title: "개인 일정", source: "google" },
      { date: "2026-10-28", start: "00:00", end: "01:00", title: "개인 일정", source: "google" },
    ]);
    // 하루를 통째로 덮으면 종일(null)
    expect(splitBusy([{ start: "2026-10-26T15:00:00Z", end: "2026-10-27T16:00:00Z" }])).toEqual([
      { date: "2026-10-27", start: null, end: null, title: "개인 일정", source: "google" },
      { date: "2026-10-28", start: "00:00", end: "01:00", title: "개인 일정", source: "google" },
    ]);
  });
});

describe("placeDay", () => {
  it("평일 19~23시에 바쁜 시간을 피해 차례로 놓고, 안 들어가면 나눈다", () => {
    const placed = placeDay({
      date: "2026-10-27", // 화
      busy: [{ title: "약속", start: "20:00", end: "21:00" }],
      blocks: [block("a", 1.5), block("b", 1)],
    }, WINDOW);
    expect(placed.map((p) => [p.itemId, p.start, p.end, p.part])).toEqual([
      ["a", "19:00", "20:00", 0],
      ["a", "21:00", "21:30", 1],
      ["b", "21:30", "22:30", 0],
    ]);
  });
  it("주말은 10시부터, 시간대를 넘치면 끝 뒤에 이어 놓는다", () => {
    const placed = placeDay({ date: "2026-10-25", busy: [], blocks: [block("a", 9)] }, WINDOW);
    expect(placed.map((p) => [p.start, p.end])).toEqual([["10:00", "18:00"], ["18:00", "19:00"]]);
  });
});

describe("buildDesired", () => {
  const posting = (o: Partial<PostingSummary>): PostingSummary => ({
    id: "x|y", company: "효성", title: "영업관리", jobCategory: "", companyType: "", employmentType: "", location: "",
    openDate: "2026-10-20", deadline: "2026-10-31", deadlineTime: "18:00", rolling: false, dday: 7, fit: "B",
    decision: "예정", status: "진행중", source: "", url: "", notes: "", estHours: null, progress: 0, origin: "collected", ...o,
  });
  const day: DayLoad = {
    date: "2026-10-27", baseHours: 3, busyHours: 0, capacity: 3, used: 1, blocks: [block("x|y", 1)], deadlines: [],
    events: [
      { id: 7, kind: "면접", title: "삼성 1차면접", date: "2026-10-27", time: "10:00", postingId: null, applicationId: "s", done: false },
      { id: 8, kind: "마감", title: "마감", date: "2026-10-27", time: null, postingId: null, applicationId: null, done: false },
    ],
    busy: [], overloaded: false,
  };

  it("예정 공고만 접수 기간으로, 미결정·보류는 넣지 않는다", () => {
    const d = buildDesired({
      today: "2026-10-24", days: [], workWindow: WINDOW,
      postings: [posting({}), posting({ id: "u", decision: "" }), posting({ id: "h", decision: "보류" }), posting({ id: "p", deadline: "2026-10-01" })],
    });
    expect(d.map((x) => x.key)).toEqual(["period:x|y"]);
    expect(d[0].body.start).toEqual({ date: "2026-10-20" });
    expect(d[0].body.end).toEqual({ date: "2026-11-01" });
    expect(d[0].body.summary).toBe("📮 효성 접수 (~18:00)");
  });

  it("전형 일정(마감 제외)과 작업 블록을 만든다", () => {
    const d = buildDesired({ today: "2026-10-24", days: [day], postings: [], workWindow: WINDOW });
    expect(d.map((x) => x.key)).toEqual(["event:7", "block:2026-10-27:x|y:0"]);
    expect(d[0].body.start).toEqual({ dateTime: "2026-10-27T10:00:00+09:00", timeZone: "Asia/Seoul" });
    expect(d[1].body.end).toEqual({ dateTime: "2026-10-27T20:00:00+09:00", timeZone: "Asia/Seoul" });
  });
});
