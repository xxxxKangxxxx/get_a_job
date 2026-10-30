// justdo(https://www.justdo.co.kr)에 서류 접수 기간을 할 일로 보낸다.
// justdo의 PUT /api/integrations/tasks는 "이 출처가 가진 할 일 전체"를 받아 추가·수정·삭제한다.
// 환경변수 JUSTDO_API_URL, JUSTDO_API_TOKEN이 없으면 아무것도 하지 않는다.
import { after } from "next/server";
import { listPostings } from "../../server/queries";
import { todayKST } from "../date";
import { JUSTDO_CATEGORY, buildJustdoItems } from "./items";

export type JustdoSyncResult = { created: number; updated: number; deleted: number; unchanged: number; sent: number };

function config() {
  const url = process.env.JUSTDO_API_URL?.replace(/\/+$/, "");
  const token = process.env.JUSTDO_API_TOKEN;
  return url && token ? { url, token } : null;
}

export const justdoConfigured = () => config() !== null;

export async function syncJustdo(): Promise<JustdoSyncResult> {
  const cfg = config();
  if (!cfg) throw new Error("JUSTDO_API_URL, JUSTDO_API_TOKEN이 없다");

  const { items: postings } = await listPostings({ decision: ["예정", "지원완료"], status: "all", limit: 500 });
  const items = buildJustdoItems(postings, todayKST());

  const res = await fetch(`${cfg.url}/api/integrations/tasks`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ category: JUSTDO_CATEGORY, items }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.json().catch(() => ({}))) as Partial<JustdoSyncResult> & { error?: string };
  if (!res.ok) throw new Error(`justdo ${res.status}: ${body.error ?? "unknown"}`);
  return {
    created: body.created ?? 0, updated: body.updated ?? 0, deleted: body.deleted ?? 0, unchanged: body.unchanged ?? 0,
    sent: items.length,
  };
}

/** 응답을 보낸 뒤 justdo 동기화를 돌린다. 설정이 없거나 요청 밖(스크립트·테스트)이면 건너뛴다. */
export function scheduleJustdoSync() {
  if (!justdoConfigured()) return;
  try {
    after(async () => {
      try {
        await syncJustdo();
      } catch (e) {
        console.error("[justdo] sync failed", e instanceof Error ? e.message : e);
      }
    });
  } catch {
    // 요청 밖에서는 after를 쓸 수 없다
  }
}
