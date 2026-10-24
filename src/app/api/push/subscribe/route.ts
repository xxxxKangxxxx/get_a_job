// POST /api/push/subscribe   body: PushSubscription.toJSON()  → 저장
// DELETE /api/push/subscribe body: { endpoint }               → 삭제
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { removeSubscription, saveSubscription } from "@/lib/push/server";

const Sub = z.object({ endpoint: z.url(), keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }) });

export async function POST(req: NextRequest) {
  const parsed = Sub.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "잘못된 구독 정보" }, { status: 400 });
  await saveSubscription(parsed.data);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (typeof body?.endpoint !== "string") return NextResponse.json({ ok: false }, { status: 400 });
  await removeSubscription(body.endpoint);
  return NextResponse.json({ ok: true });
}
