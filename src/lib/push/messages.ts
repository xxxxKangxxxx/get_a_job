// 알림 문구 만들기 (순수 함수). 데이터는 @/server/queries 결과를 그대로 받는다.
import type { InboxView, TodayView } from "../../contracts/types";
import type { PushPayload } from "./server";

/** 아침 브리핑 (D11): 오늘 할 일·가용 시간·오늘 일정·경고 */
export function briefing(t: TodayView): PushPayload {
  const lines: string[] = [];
  const todo = t.tasks.filter((x) => !x.done);
  if (todo.length) {
    const top = todo.slice(0, 3).map((x) => `${x.company} ${x.label} ${x.hours}h`).join(", ");
    lines.push(`할 일 ${todo.length}개 (${t.availableHours}시간): ${top}${todo.length > 3 ? " 외" : ""}`);
  } else {
    lines.push(`오늘은 잡힌 작업이 없어요 (가용 ${t.availableHours}시간)`);
  }
  const today = t.week.find((d) => d.date === t.date);
  const ev = today?.events.filter((e) => !e.done) ?? [];
  if (ev.length) lines.push(`오늘 일정: ${ev.map((e) => `${e.time ? e.time + " " : ""}${e.title}`).join(", ")}`);
  const dl = today?.deadlines ?? [];
  if (dl.length) lines.push(`오늘 마감: ${dl.map((d) => d.company).join(", ")}`);
  if (t.warnings.length) lines.push(`⚠️ ${t.warnings[0].title}`);
  if (t.counts.needDecision) lines.push(`결정 필요한 A급 공고 ${t.counts.needDecision}건`);
  return { title: "오늘의 취업 일정", body: lines.join("\n"), url: "/", tag: `briefing-${t.date}` };
}

/** 미결정 A급 공고 → "지원할까요?" 알림 (최대 max건) */
export function decisionPrompts(inbox: InboxView, max = 3): PushPayload[] {
  return inbox.cards
    .filter((c) => c.reason === "needDecision")
    .slice(0, max)
    .map((c) => ({
      title: `지원할까요? ${c.company}${c.dday !== null ? ` · D-${c.dday}` : ""}`,
      body: `${c.title}\n${c.impact.message}`,
      url: "/",
      tag: `decide-${c.id}`,
      postingId: c.id,
      actions: [
        { action: "apply", title: "지원할래요" },
        { action: "skip", title: "관심 없음" },
      ],
    }));
}
