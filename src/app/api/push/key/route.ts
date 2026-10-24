// GET /api/push/key → { publicKey } (구독할 때 필요한 VAPID 공개키)
import { NextResponse, connection } from "next/server";
import { vapidPublicKey } from "@/lib/push/server";

export async function GET() {
  await connection(); // 빌드 때 굽지 않고 요청마다 환경변수를 읽는다
  return NextResponse.json({ publicKey: vapidPublicKey() });
}
