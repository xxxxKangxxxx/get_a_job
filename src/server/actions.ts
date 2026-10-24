"use server";
// 화면에서 무언가를 바꿀 때 부르는 서버 액션들.
// 지금은 아무것도 저장하지 않는다. 백엔드가 같은 이름·모양으로 실제 구현으로 바꾼다.
// 구현 규칙: 성공하면 관련 화면을 다시 그리도록 revalidatePath를 부르고 { ok: true }를 돌려준다.
import type {
  ActionResult, DismissReason, PostingPatch, NewPostingInput, NewEventInput, AppSettings, Fix,
} from "@/contracts/types";

/** 받은편지함 결정. x(관심 없음)일 때 reason을 주면 숨김 규칙을 만든다. */
export async function decideInbox(postingId: string, decision: "예정" | "보류" | "x", reason?: DismissReason): Promise<ActionResult> {
  void postingId; void decision; void reason;
  return { ok: true };
}

/** 방금 한 받은편지함 결정 되돌리기 */
export async function undoDecision(postingId: string): Promise<ActionResult> {
  void postingId;
  return { ok: true };
}

/** 오늘 할 일 체크/해제. 지원서 작업을 체크하면 진행률을 progressTo로 올린다. */
export async function toggleTask(taskId: string, done: boolean): Promise<ActionResult> {
  void taskId; void done;
  return { ok: true };
}

export async function updatePosting(id: string, patch: PostingPatch): Promise<ActionResult> {
  void id; void patch;
  return { ok: true };
}

export async function createPosting(input: NewPostingInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  return { ok: true, id: `${input.company}|${input.title}` };
}

/** 지원서 제출함: decision=지원완료, 지원현황에 "서류 결과 대기"로 추가 */
export async function markSubmitted(postingId: string, appliedAt?: string): Promise<ActionResult> {
  void postingId; void appliedAt;
  return { ok: true };
}

/** 전형 단계 바꾸기. 다음 일정을 함께 주면 일정에 추가한다. */
export async function setStage(applicationId: string, stage: string, nextEvent?: NewEventInput): Promise<ActionResult> {
  void applicationId; void stage; void nextEvent;
  return { ok: true };
}

/** 시간 부족 경고의 해결책 적용 (포기 / 날짜별 시간 늘리기) */
export async function applyFix(fix: Fix): Promise<ActionResult> {
  void fix;
  return { ok: true };
}

export async function addEvent(input: NewEventInput): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  void input;
  return { ok: true, id: Date.now() };
}

export async function updateEvent(id: number, patch: Partial<NewEventInput> & { done?: boolean }): Promise<ActionResult> {
  void id; void patch;
  return { ok: true };
}

export async function deleteEvent(id: number): Promise<ActionResult> {
  void id;
  return { ok: true };
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<ActionResult> {
  void patch;
  return { ok: true };
}

export async function removeHideRule(id: number): Promise<ActionResult> {
  void id;
  return { ok: true };
}
