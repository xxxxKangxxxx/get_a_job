import { describe, expect, it } from "vitest";
import { buildJustdoItems, externalIdOf } from "./items";
import type { PostingSummary } from "../../contracts/types";

const TODAY = "2026-10-30";

const posting = (over: Partial<PostingSummary> = {}): PostingSummary => ({
  id: "동국제약|구매팀", company: "동국제약", title: "구매팀 신입", jobCategory: "구매", companyType: "중견기업",
  employmentType: "신입 정규직", location: "서울", openDate: "2026-10-20", deadline: "2026-11-02", deadlineTime: "18:00",
  rolling: false, dday: 3, fit: "A", decision: "예정", status: "진행중", source: "", url: "https://example.com/p/1",
  notes: "", estHours: null, progress: 0, origin: "collected",
  ...over,
});

describe("buildJustdoItems", () => {
  it("지원 예정 공고의 접수 기간을 열린 할 일로 만든다", () => {
    expect(buildJustdoItems([posting()], TODAY)).toEqual([{
      externalId: "period:동국제약|구매팀",
      title: "동국제약 서류 접수 (~18:00)",
      memo: "구매팀 신입\n적합도 A\nhttps://example.com/p/1",
      startDate: "2026-10-20",
      endDate: "2026-11-02",
      completed: false,
    }]);
  });

  it("지원완료 공고는 완료된 할 일로 보낸다", () => {
    expect(buildJustdoItems([posting({ decision: "지원완료" })], TODAY)[0].completed).toBe(true);
  });

  it("미정·보류·관심 없음, 수시, 지난 마감은 보내지 않는다", () => {
    const items = buildJustdoItems([
      posting({ id: "a", decision: "" }),
      posting({ id: "b", decision: "보류" }),
      posting({ id: "c", decision: "x" }),
      posting({ id: "d", deadline: null, rolling: true }),
      posting({ id: "e", deadline: "2026-10-29" }),
      posting({ id: "f", deadline: TODAY }),
    ], TODAY);
    expect(items.map((i) => i.externalId)).toEqual(["period:f"]);
  });

  it("시작일이 없거나 마감보다 늦으면 마감 하루짜리로 만든다", () => {
    expect(buildJustdoItems([posting({ openDate: null })], TODAY)[0].startDate).toBe("2026-11-02");
    expect(buildJustdoItems([posting({ openDate: "2026-11-05" })], TODAY)[0].startDate).toBe("2026-11-02");
  });

  it("마감 시각·적합도·링크가 없으면 빼고 쓴다", () => {
    const [i] = buildJustdoItems([posting({ deadlineTime: null, fit: "", url: "" })], TODAY);
    expect(i.title).toBe("동국제약 서류 접수");
    expect(i.memo).toBe("구매팀 신입");
  });
});

describe("externalIdOf", () => {
  it("긴 id는 해시로 줄인다", () => {
    const id = externalIdOf("가".repeat(300));
    expect(id.startsWith("period#")).toBe(true);
    expect(id.length).toBeLessThanOrEqual(200);
  });
});
