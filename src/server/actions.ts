"use server";
// 화면에서 무언가를 바꿀 때 부르는 서버 액션들.
// 성공하면 화면을 다시 그리도록 revalidatePath를 부르고 { ok: true }를 돌려준다.
// 앱에서 바꾼 공고·지원 필드는 userEditedFields에 넣어 동기화가 덮어쓰지 않게 한다.
import { refresh as refreshRouter, revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import type {
  ActionResult, DismissReason, PostingPatch, NewPostingInput, NewEventInput, AppSettings, Fix, EventKind,
} from "../contracts/types";
import { db } from "../db";
import { applications, events, hideRules, meta, postings, type InboxPrev } from "../db/schema";
import { todayKST } from "../lib/date";
import { applyHideRules, loadDailyPlan, loadPlanInput, loadSettings, loadSourceMeta, saveDailyPlan } from "./data";
import { baseHoursOf, buildContext, runPlan, toTodayTasks } from "./plan";
import { mergeSettings, validateSettingsPatch } from "./settings";
import { scheduleJustdoSync } from "../lib/justdo/sync";

const DECISIONS = ["", "예정", "보류", "x", "지원완료"];
const FITS = ["A", "B", "C", ""];
const EVENT_KINDS: EventKind[] = ["서류발표", "인적성", "면접", "설명회", "마감", "기타"];
const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const isTime = (s: unknown): s is string => typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

const ok = (): ActionResult => ({ ok: true });
const fail = (error: string) => ({ ok: false as const, error });

/** 모든 화면을 다시 그린다. Next 밖(스크립트·테스트)에서 부르면 무시한다. */
function refresh() {
  try {
    revalidatePath("/", "layout");
    refreshRouter(); // 요청마다 읽는 화면(connection)도 새 데이터로 다시 그린다
  } catch {
    // 요청 밖(스크립트·테스트·라우트 핸들러)에서는 쓸 수 없다
  }
}

function withEdited(current: string[], fields: string[]): string[] {
  return [...new Set([...current, ...fields])];
}

async function getPostingRow(id: string) {
  const [p] = await db.select().from(postings).where(eq(postings.id, id));
  return p;
}

/** 공고 결정 바꾸기 (되돌리기용 직전 값을 남긴다) */
async function setDecision(id: string, decision: string, ruleId: number | null = null): Promise<ActionResult> {
  const p = await getPostingRow(id);
  if (!p) return fail("공고를 찾을 수 없어요");
  const prev: InboxPrev = {
    decision: p.decision, inboxState: p.inboxState, decisionEdited: p.userEditedFields.includes("decision"), ruleId,
  };
  await db.update(postings).set({
    decision, inboxState: "seen", decidedAt: new Date(), inboxPrev: prev,
    userEditedFields: withEdited(p.userEditedFields, ["decision"]), updatedAt: new Date(),
  }).where(eq(postings.id, id));
  return ok();
}

/** 받은편지함 결정. x(관심 없음)일 때 reason을 주면 숨김 규칙을 만든다. */
export async function decideInbox(postingId: string, decision: "예정" | "보류" | "x", reason?: DismissReason): Promise<ActionResult> {
  if (!["예정", "보류", "x"].includes(decision)) return fail("잘못된 결정이에요");
  if (!(await getPostingRow(postingId))) return fail("공고를 찾을 수 없어요");

  let newRuleId: number | null = null;
  let ruleId: number | null = null;
  const value = reason?.value?.trim();
  if (decision === "x" && reason && reason.kind !== "other" && value) {
    const [same] = await db.select().from(hideRules).where(and(eq(hideRules.kind, reason.kind), eq(hideRules.value, value)));
    if (same) ruleId = same.id;
    else {
      const [r] = await db.insert(hideRules).values({ kind: reason.kind, value }).returning({ id: hideRules.id });
      ruleId = newRuleId = r.id;
    }
  }
  const res = await setDecision(postingId, decision, newRuleId);
  if (!res.ok) return res;
  if (ruleId !== null) await applyHideRules(db, { ruleIds: [ruleId] });
  refresh();
  scheduleJustdoSync();
  return ok();
}

/** 방금 한 받은편지함 결정 되돌리기 */
export async function undoDecision(postingId: string): Promise<ActionResult> {
  const p = await getPostingRow(postingId);
  if (!p) return fail("공고를 찾을 수 없어요");
  const prev = p.inboxPrev;
  if (!prev) return fail("되돌릴 결정이 없어요");
  const edited = prev.decisionEdited ? p.userEditedFields : p.userEditedFields.filter((f) => f !== "decision");
  await db.update(postings).set({
    decision: prev.decision, inboxState: prev.inboxState, decidedAt: null, inboxPrev: null,
    userEditedFields: edited, updatedAt: new Date(),
  }).where(eq(postings.id, postingId));
  if (prev.ruleId !== null) await deleteRule(prev.ruleId);
  refresh();
  scheduleJustdoSync();
  return ok();
}

/** 규칙을 지우고 그 규칙으로 숨긴 공고를 되살린다 (다른 규칙에 걸리면 다시 숨김) */
async function deleteRule(ruleId: number) {
  const hidden = await db.select({ id: postings.id }).from(postings).where(eq(postings.hiddenByRule, ruleId));
  await db.update(postings).set({ hiddenByRule: null }).where(eq(postings.hiddenByRule, ruleId));
  await db.delete(hideRules).where(eq(hideRules.id, ruleId));
  await applyHideRules(db, { postingIds: hidden.map((h) => h.id) });
}

/** 오늘 할 일 체크/해제. 지원서 작업을 체크하면 진행률을 progressTo로 올린다. */
export async function toggleTask(taskId: string, done: boolean): Promise<ActionResult> {
  const today = todayKST();
  if (!taskId.startsWith(`${today}:`)) return fail("오늘 할 일만 체크할 수 있어요");
  const state = await loadDailyPlan(db, today);
  const settings = await loadSettings(db);

  if (done) {
    if (state.done[taskId]) return ok();
    const ctx = buildContext(await loadPlanInput(db, today), 14);
    const task = toTodayTasks(ctx, runPlan(ctx)).find((t) => t.id === taskId && !t.done);
    if (!task) return fail("할 일을 찾을 수 없어요. 화면을 새로고침해 주세요");
    state.done[taskId] = { ...task, done: true };
    await saveDailyPlan(db, today, state, baseHoursOf(today, settings));
    if (task.kind === "application" && task.postingId && task.progressTo !== null) {
      await setProgress(task.postingId, task.progressTo);
    }
  } else {
    const task = state.done[taskId];
    if (!task) return ok();
    delete state.done[taskId];
    await saveDailyPlan(db, today, state, baseHoursOf(today, settings));
    if (task.kind === "application" && task.postingId && task.progressFrom !== null) {
      await setProgress(task.postingId, task.progressFrom);
    }
  }
  refresh();
  return ok();
}

async function setProgress(postingId: string, progress: number) {
  const p = await getPostingRow(postingId);
  if (!p) return;
  await db.update(postings).set({
    progress: Math.max(0, Math.min(100, Math.round(progress))),
    userEditedFields: withEdited(p.userEditedFields, ["progress"]), updatedAt: new Date(),
  }).where(eq(postings.id, postingId));
}

function validatePatch(patch: PostingPatch): string | null {
  if ("decision" in patch && !DECISIONS.includes(patch.decision as string)) return "잘못된 지원 여부예요";
  if ("fit" in patch && !FITS.includes(patch.fit as string)) return "적합도는 A·B·C 중 하나예요";
  if ("progress" in patch && !(Number.isInteger(patch.progress) && patch.progress! >= 0 && patch.progress! <= 100)) return "진행률은 0~100 정수예요";
  if ("estHours" in patch && patch.estHours !== null && !(typeof patch.estHours === "number" && patch.estHours > 0 && patch.estHours <= 200)) return "예상 시간은 0보다 큰 숫자예요";
  if ("deadline" in patch && patch.deadline !== null && !isDate(patch.deadline)) return "마감일은 YYYY-MM-DD 형식이에요";
  if ("deadlineTime" in patch && patch.deadlineTime !== null && !isTime(patch.deadlineTime)) return "마감 시각은 HH:MM 형식이에요";
  return null;
}

export async function updatePosting(id: string, patch: PostingPatch): Promise<ActionResult> {
  const err = validatePatch(patch);
  if (err) return fail(err);
  const p = await getPostingRow(id);
  if (!p) return fail("공고를 찾을 수 없어요");
  const fields = (Object.keys(patch) as (keyof PostingPatch)[]).filter((k) => patch[k] !== undefined);
  if (fields.length === 0) return ok();
  const set: Partial<typeof postings.$inferInsert> = { updatedAt: new Date() };
  for (const k of fields) (set as Record<string, unknown>)[k] = patch[k];
  if (fields.includes("decision") && patch.decision !== "") { set.inboxState = "seen"; set.decidedAt = new Date(); }
  set.userEditedFields = withEdited(p.userEditedFields, fields);
  await db.update(postings).set(set).where(eq(postings.id, id));
  refresh();
  scheduleJustdoSync();
  return ok();
}

export async function createPosting(input: NewPostingInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const company = input.company?.trim();
  const title = input.title?.trim();
  if (!company || !title) return fail("회사명과 공고명을 입력해 주세요");
  if (input.deadline && !isDate(input.deadline)) return fail("마감일은 YYYY-MM-DD 형식이에요");
  if (input.openDate && !isDate(input.openDate)) return fail("시작일은 YYYY-MM-DD 형식이에요");
  if (input.deadlineTime && !isTime(input.deadlineTime)) return fail("마감 시각은 HH:MM 형식이에요");
  if (input.fit && !FITS.includes(input.fit)) return fail("적합도는 A·B·C 중 하나예요");
  const id = `${company}|${title}`;
  if (await getPostingRow(id)) return fail("이미 같은 공고가 있어요");
  const row = {
    id, company, title,
    jobCategory: input.jobCategory ?? "", companyType: input.companyType ?? "", employmentType: input.employmentType ?? "",
    location: input.location ?? "", openDate: input.openDate ?? null, deadline: input.deadline ?? null,
    deadlineTime: input.deadlineTime ?? null, url: input.url ?? "", notes: input.notes ?? "", fit: input.fit ?? "",
    estHours: input.estHours ?? null, surveyedAt: todayKST(), origin: "manual", source: "직접 추가",
  };
  await db.insert(postings).values({ ...row, userEditedFields: Object.keys(row).filter((k) => k !== "id") });
  refresh();
  scheduleJustdoSync();
  return { ok: true, id };
}

/** 지원서 제출함: decision=지원완료, 지원현황에 "서류 결과 대기"로 추가 */
export async function markSubmitted(postingId: string, appliedAt?: string): Promise<ActionResult> {
  if (appliedAt !== undefined && !isDate(appliedAt)) return fail("지원일은 YYYY-MM-DD 형식이에요");
  const p = await getPostingRow(postingId);
  if (!p) return fail("공고를 찾을 수 없어요");
  await db.update(postings).set({
    decision: "지원완료", progress: 100, inboxState: "seen", decidedAt: new Date(),
    userEditedFields: withEdited(p.userEditedFields, ["decision", "progress"]), updatedAt: new Date(),
  }).where(eq(postings.id, postingId));
  const stage = "서류 결과 대기";
  await db.insert(applications).values({
    id: postingId, postingId, company: p.company, title: p.title, jobCategory: p.jobCategory,
    appliedAt: appliedAt ?? todayKST(), deadline: p.deadline, stage, source: p.source, url: p.url,
    log: [{ at: new Date().toISOString(), from: "준비 중", to: stage }],
  }).onConflictDoNothing({ target: applications.id });
  refresh();
  scheduleJustdoSync();
  return ok();
}

function validateEvent(e: Partial<NewEventInput>, partial: boolean): string | null {
  if ((!partial || "kind" in e) && !EVENT_KINDS.includes(e.kind as EventKind)) return "일정 종류가 잘못됐어요";
  if ((!partial || "title" in e) && !e.title?.trim()) return "일정 제목을 입력해 주세요";
  if ((!partial || "date" in e) && !isDate(e.date)) return "날짜는 YYYY-MM-DD 형식이에요";
  if (e.time !== undefined && e.time !== null && !isTime(e.time)) return "시각은 HH:MM 형식이에요";
  return null;
}

/** 전형 단계 바꾸기. 다음 일정을 함께 주면 일정에 추가한다. */
export async function setStage(applicationId: string, stage: string, nextEvent?: NewEventInput): Promise<ActionResult> {
  const [a] = await db.select().from(applications).where(eq(applications.id, applicationId));
  if (!a) return fail("지원 내역을 찾을 수 없어요");
  const stages = (await loadSourceMeta(db)).전형단계 ?? [];
  if (stages.length > 0 && !stages.includes(stage)) return fail("없는 전형 단계예요");
  if (nextEvent) {
    const err = validateEvent(nextEvent, false);
    if (err) return fail(err);
  }
  if (stage !== a.stage) {
    await db.update(applications).set({
      stage, log: [...a.log, { at: new Date().toISOString(), from: a.stage, to: stage }],
      userEditedFields: withEdited(a.userEditedFields, ["stage"]), updatedAt: new Date(),
    }).where(eq(applications.id, applicationId));
  }
  if (nextEvent) {
    await db.insert(events).values({
      kind: nextEvent.kind, title: nextEvent.title.trim(), date: nextEvent.date, time: nextEvent.time ?? null,
      postingId: nextEvent.postingId ?? a.postingId, applicationId: nextEvent.applicationId ?? applicationId,
      notes: nextEvent.notes ?? "", origin: "manual",
    });
  }
  refresh();
  return ok();
}

/** 시간 부족 경고의 해결책 적용 (포기 / 날짜별 시간 늘리기) */
export async function applyFix(fix: Fix): Promise<ActionResult> {
  if (fix.kind === "drop") {
    if (!fix.postingId) return fail("포기할 공고가 없어요");
    const res = await setDecision(fix.postingId, "x");
    if (!res.ok) return res;
  } else if (fix.kind === "addHours") {
    if (!isDate(fix.date) || !(typeof fix.hours === "number" && fix.hours > 0)) return fail("날짜와 시간이 필요해요");
    const s = await loadSettings(db);
    const hours = Math.min(24, baseHoursOf(fix.date, s) + fix.hours);
    await saveSettings({ ...s, overrides: { ...s.overrides, [fix.date]: hours } });
  } else {
    return fail("알 수 없는 해결책이에요");
  }
  refresh();
  return ok();
}

export async function addEvent(input: NewEventInput): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const err = validateEvent(input, false);
  if (err) return fail(err);
  const [r] = await db.insert(events).values({
    kind: input.kind, title: input.title.trim(), date: input.date, time: input.time ?? null,
    postingId: input.postingId ?? null, applicationId: input.applicationId ?? null, notes: input.notes ?? "", origin: "manual",
  }).returning({ id: events.id });
  refresh();
  return { ok: true, id: r.id };
}

export async function updateEvent(id: number, patch: Partial<NewEventInput> & { done?: boolean }): Promise<ActionResult> {
  const err = validateEvent(patch, true);
  if (err) return fail(err);
  const [e] = await db.select({ id: events.id }).from(events).where(eq(events.id, id));
  if (!e) return fail("일정을 찾을 수 없어요");
  const set: Partial<typeof events.$inferInsert> = {};
  for (const k of ["kind", "title", "date", "time", "postingId", "applicationId", "notes", "done"] as const) {
    if (patch[k] !== undefined) (set as Record<string, unknown>)[k] = k === "title" ? patch.title!.trim() : patch[k];
  }
  if (Object.keys(set).length > 0) await db.update(events).set(set).where(eq(events.id, id));
  refresh();
  return ok();
}

export async function deleteEvent(id: number): Promise<ActionResult> {
  await db.delete(events).where(eq(events.id, id));
  refresh();
  return ok();
}

async function saveSettings(s: AppSettings) {
  await db.insert(meta).values({ key: "settings", value: s })
    .onConflictDoUpdate({ target: meta.key, set: { value: s } });
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<ActionResult> {
  const err = validateSettingsPatch(patch);
  if (err) return fail(err);
  const cur = await loadSettings(db);
  await saveSettings(mergeSettings({
    ...cur, ...patch,
    workWindow: { weekday: { ...cur.workWindow.weekday, ...patch.workWindow?.weekday }, weekend: { ...cur.workWindow.weekend, ...patch.workWindow?.weekend } },
  }));
  refresh();
  return ok();
}

export async function removeHideRule(id: number): Promise<ActionResult> {
  const [r] = await db.select({ id: hideRules.id }).from(hideRules).where(eq(hideRules.id, id));
  if (!r) return fail("규칙을 찾을 수 없어요");
  await deleteRule(id);
  // 이 규칙으로 만든 결정의 되돌리기 정보가 남아 있으면 규칙 연결만 끊는다
  const linked = await db.select({ id: postings.id, prev: postings.inboxPrev }).from(postings)
    .where(inArray(postings.decision, ["x"]));
  for (const p of linked) {
    if (p.prev?.ruleId === id) await db.update(postings).set({ inboxPrev: { ...p.prev, ruleId: null } }).where(eq(postings.id, p.id));
  }
  refresh();
  return ok();
}
