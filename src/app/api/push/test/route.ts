// POST /api/push/test → 모든 기기에 테스트 알림
import { NextResponse } from "next/server";
import { sendToAll } from "@/lib/push/server";

export async function POST() {
  const r = await sendToAll({ title: "테스트 알림", body: "알림이 잘 와요 👋", url: "/", tag: "test" });
  return NextResponse.json({ ok: true, ...r });
}
