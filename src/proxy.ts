// 앱 전체를 비밀번호 로그인으로 잠근다 (D3).
// - /login, /privacy, /api/auth/* : 누구나
// - /api/cron/*         : CRON_SECRET 헤더로만 (로그인 쿠키 무시)
// - 그 외               : 서명 쿠키가 있어야 함. 페이지는 /login으로, API는 401.
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionValue, checkCronAuth } from "@/app/login/_lib/session";

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (pathname === "/login" || pathname === "/privacy" || pathname.startsWith("/api/auth/")) return NextResponse.next();

  if (pathname.startsWith("/api/cron/")) {
    if (checkCronAuth(req.headers.get("authorization"))) return NextResponse.next();
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (await verifySessionValue(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // 정적 파일·서비스 워커·아이콘은 잠그지 않는다 (홈 화면 추가와 푸시가 동작하려면 필요).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|.*\\.(?:png|svg|jpg|jpeg|webp|ico|woff2?)$).*)",
  ],
};
