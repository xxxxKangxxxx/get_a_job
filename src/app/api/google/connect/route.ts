// GET /api/google/connect → 구글 동의 화면으로 보낸다. (로그인 필요, 설정 화면의 "구글 캘린더 연결" 버튼이 이 주소로 이동)
import { NextResponse, type NextRequest } from "next/server";
import { authUrl } from "@/lib/google/oauth";
import { isGoogleConfigured } from "@/lib/google/config";

export async function GET(req: NextRequest) {
  if (!isGoogleConfigured()) return NextResponse.json({ error: "GOOGLE_CLIENT_ID/SECRET 미설정" }, { status: 500 });
  const state = crypto.randomUUID();
  const res = NextResponse.redirect(authUrl(req.nextUrl.origin, state));
  res.cookies.set("gaj_oauth_state", state, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/google", maxAge: 600,
  });
  return res;
}
