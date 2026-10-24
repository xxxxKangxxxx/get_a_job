// cron 작업 본체. 각 라우트와 /api/cron/daily가 같이 쓴다.
// 인증은 proxy가 한다 (Authorization: Bearer <CRON_SECRET>).
import { getInbox, getToday } from "@/server/queries";
import { briefing, decisionPrompts } from "@/lib/push/messages";
import { sendToAll } from "@/lib/push/server";
import { syncCalendar } from "@/lib/google/sync";
import { getAccount } from "@/lib/google/oauth";

export async function runGoogleSync() {
  if (!(await getAccount())) return { skipped: "구글 캘린더 미연결" };
  return syncCalendar();
}

export async function runBriefing() {
  return sendToAll(briefing(await getToday()));
}

export async function runDecisions() {
  const prompts = decisionPrompts(await getInbox());
  let sent = 0;
  for (const p of prompts) sent += (await sendToAll(p)).sent;
  return { prompts: prompts.length, sent };
}

/** 하나가 실패해도 나머지는 돈다 */
export async function settle<T>(fn: () => Promise<T>): Promise<{ ok: true; result: T } | { ok: false; error: string }> {
  try {
    return { ok: true, result: await fn() };
  } catch (e) {
    console.error(e);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
