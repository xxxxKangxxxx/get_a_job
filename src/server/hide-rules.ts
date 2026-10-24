// 숨김 규칙(D13) 판정. 순수 함수.
import type { DismissReasonKind } from "../contracts/types";

export type RuleLike = { id: number; kind: string; value: string };
export type PostingLike = {
  company: string; jobCategory: string; location: string; employmentType: string; companyType: string;
};

const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();

/** 규칙이 공고에 맞는지. 근무지는 포함 여부("울산" ⊂ "울산 남구"), 나머지는 같은 값. other는 자동 숨김하지 않는다. */
export function ruleMatches(rule: RuleLike, p: PostingLike): boolean {
  const v = norm(rule.value);
  if (!v) return false;
  switch (rule.kind as DismissReasonKind) {
    case "location": return norm(p.location).includes(v);
    case "jobCategory": return norm(p.jobCategory) === v;
    case "employmentType": return norm(p.employmentType) === v;
    case "companyType": return norm(p.companyType) === v;
    case "company": return norm(p.company) === v;
    default: return false;
  }
}

/** 처음 맞는 규칙 id, 없으면 null */
export function firstMatchingRule(rules: RuleLike[], p: PostingLike): number | null {
  for (const r of rules) if (ruleMatches(r, p)) return r.id;
  return null;
}
