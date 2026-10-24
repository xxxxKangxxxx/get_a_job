// 로그인 폼(POST, form-data: password, next) → 서명 쿠키를 붙이고 원래 가려던 곳으로 보낸다.
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, SESSION_DAYS, checkPassword, createSessionValue, safeNext } from "@/app/login/_lib/session";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const password = String(form.get("password") ?? "");
  const next = safeNext(form.get("next"));

  if (!checkPassword(password)) {
    // 무차별 대입을 늦춘다
    await new Promise((r) => setTimeout(r, 1000));
    const url = new URL("/login", req.url);
    url.searchParams.set("error", "1");
    if (next !== "/") url.searchParams.set("next", next);
    return NextResponse.redirect(url, 303);
  }

  const res = NextResponse.redirect(new URL(next, req.url), 303);
  res.cookies.set(SESSION_COOKIE, await createSessionValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
  return res;
}
