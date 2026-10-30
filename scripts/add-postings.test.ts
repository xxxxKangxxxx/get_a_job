import { describe, expect, it } from "vitest";
import { mergePostings, type Data } from "./add-postings";

const TODAY = "2026-10-30";
const data = (): Data => ({
  meta: {},
  공고: [{ id: "A사|공채", 기업명: "A사", 공고명: "공채", 근무지: "", 접수마감: "2026-10-29", 상태: "진행중" }],
  지원현황: [],
});
const item = { 기업명: "B사", 공고명: "신입 채용", 적합도: "A", 기업형태: "대기업", 접수시작: "2026-10-20", 접수마감: "2026-11-05", 링크: "https://example.com" };

describe("mergePostings", () => {
  it("새 공고를 추가하고 지난 공고는 마감으로 옮긴다", () => {
    const d = data();
    const r = mergePostings(d, [item], TODAY);
    expect(r.errs).toEqual([]);
    expect(r.added).toHaveLength(1);
    expect(r.archived).toHaveLength(1);
    expect(d.공고[0].상태).toBe("마감");
    expect(d.공고[1]).toMatchObject({ id: "B사|신입 채용", 지원여부: "", 상태: "진행중", 조사일: TODAY, 근무지: "" });
  });

  it("이미 있는 공고는 건너뛰고, 빈 근무지는 채운다", () => {
    const d = data();
    const r = mergePostings(d, [{ 기업명: "A사", 공고명: "공채", 적합도: "A" }, { _근무지보강: "1", 기업명: "A사", 공고명: "공채", 근무지: "서울" }], TODAY);
    expect(r.skipped).toHaveLength(1);
    expect(d.공고[0].근무지).toBe("서울");
  });

  it("값이 틀리면 오류를 모두 모은다", () => {
    const r = mergePostings(data(), [{ ...item, 적합도: "S", 기업형태: "스타트업", 접수마감: "11/5" }], TODAY);
    expect(r.errs).toHaveLength(3);
  });

  it("수시 채용은 \"수시\" 그대로 두고 진행중", () => {
    const d = data();
    mergePostings(d, [{ ...item, 접수마감: "수시" }], TODAY);
    expect(d.공고[1]).toMatchObject({ 접수마감: "수시", 상태: "진행중" }); // sync가 "수시"를 보고 rolling으로 넣는다
  });
});
