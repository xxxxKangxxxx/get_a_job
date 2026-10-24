// POST /api/push/decide  body: { postingId, action: "apply" | "skip" }
// 알림의 "지원할래요 / 관심 없음" 버튼을 서비스 워커가 이 주소로 보낸다 (D11).
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { decideInbox } from "@/server/actions";

const Body = z.object({ postingId: z.string().min(1), action: z.enum(["apply", "skip"]) });

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "잘못된 요청" }, { status: 400 });
  const r = await decideInbox(parsed.data.postingId, parsed.data.action === "apply" ? "예정" : "x");
  return NextResponse.json(r, { status: r.ok ? 200 : 500 });
}
