import { describe, it, expect } from "vitest";
import { firstMatchingRule, ruleMatches } from "./hide-rules";

const p = { company: "LS MnM", jobCategory: "재무·자금", location: "울산 남구", employmentType: "신입 정규직", companyType: "대기업" };

describe("숨김 규칙", () => {
  it("근무지는 포함 여부로 본다", () => {
    expect(ruleMatches({ id: 1, kind: "location", value: "울산" }, p)).toBe(true);
    expect(ruleMatches({ id: 1, kind: "location", value: "서울" }, p)).toBe(false);
  });
  it("나머지는 같은 값(공백·대소문자 무시)", () => {
    expect(ruleMatches({ id: 1, kind: "company", value: "ls mnm" }, p)).toBe(true);
    expect(ruleMatches({ id: 1, kind: "company", value: "LS" }, p)).toBe(false);
    expect(ruleMatches({ id: 1, kind: "jobCategory", value: "재무·자금" }, p)).toBe(true);
    expect(ruleMatches({ id: 1, kind: "employmentType", value: "인턴" }, p)).toBe(false);
    expect(ruleMatches({ id: 1, kind: "companyType", value: "대기업" }, p)).toBe(true);
  });
  it("other와 빈 값은 자동 숨김하지 않는다", () => {
    expect(ruleMatches({ id: 1, kind: "other", value: "연봉 낮음" }, p)).toBe(false);
    expect(ruleMatches({ id: 1, kind: "location", value: " " }, p)).toBe(false);
  });
  it("처음 맞는 규칙 id", () => {
    expect(firstMatchingRule([{ id: 3, kind: "location", value: "부산" }, { id: 4, kind: "companyType", value: "대기업" }], p)).toBe(4);
    expect(firstMatchingRule([], p)).toBeNull();
  });
});
