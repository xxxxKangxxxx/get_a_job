// 로그아웃 (POST) → 쿠키를 지우고 /login으로.
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/app/login/_lib/session";

export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/login", req.url), 303);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
