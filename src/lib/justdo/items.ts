// justdo로 보낼 할 일 계산 (순수 함수 → 테스트 가능).
// 서류 접수 기간만 보낸다: 지원 예정 공고는 열린 할 일, 지원완료 공고는 완료된 할 일.
// 마감이 없거나(수시) 이미 지난 공고는 보내지 않는다. justdo는 지난 할 일을 지우지 않고 남긴다.
import { createHash } from "node:crypto";
import type { PostingSummary } from "../../contracts/types";

export type JustdoItem = {
  externalId: string;
  title: string;
  memo: string | null;
  startDate: string;
  endDate: string;
  completed: boolean;
};

export const JUSTDO_CATEGORY = "취업";

/** justdo의 externalId는 200자까지. 공고 id(회사|공고명)가 길면 해시로 줄인다. */
export function externalIdOf(postingId: string): string {
  const id = `period:${postingId}`;
  return id.length <= 200 ? id : `period#${createHash("sha256").update(postingId).digest("hex")}`;
}

export function buildJustdoItems(postings: PostingSummary[], today: string): JustdoItem[] {
  const out: JustdoItem[] = [];
  for (const p of postings) {
    if (p.decision !== "예정" && p.decision !== "지원완료") continue;
    if (!p.deadline || p.deadline < today) continue;
    const start = p.openDate && p.openDate <= p.deadline ? p.openDate : p.deadline;
    const memo = [p.title, p.fit ? `적합도 ${p.fit}` : "", p.url].filter(Boolean).join("\n");
    out.push({
      externalId: externalIdOf(p.id),
      title: `${p.company} 서류 접수${p.deadlineTime ? ` (~${p.deadlineTime})` : ""}`.slice(0, 200),
      memo: memo ? memo.slice(0, 2000) : null,
      startDate: start,
      endDate: p.deadline,
      completed: p.decision === "지원완료",
    });
  }
  return out;
}
