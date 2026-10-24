// GET /api/google/callback?code&state → 토큰 저장, "취업 일정" 캘린더 준비, 첫 동기화 후 설정 화면으로.
import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode } from "@/lib/google/oauth";
import { ensureAppCalendar, syncCalendar } from "@/lib/google/sync";
import { writeCalendarStatus } from "@/lib/google/status";

const back = (req: NextRequest, q: string) => {
  const res = NextResponse.redirect(new URL(`/settings?google=${q}`, req.url));
  res.cookies.delete({ name: "gaj_oauth_state", path: "/api/google" });
  return res;
};

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  if (sp.get("error")) return back(req, "denied");
  const state = req.cookies.get("gaj_oauth_state")?.value;
  if (!state || state !== sp.get("state") || !sp.get("code")) return back(req, "bad_state");

  try {
    await exchangeCode(req.nextUrl.origin, sp.get("code")!);
    await ensureAppCalendar();
    await writeCalendarStatus();
  } catch (e) {
    console.error("google callback", e);
    return back(req, "error");
  }
  // 첫 동기화는 실패해도 연결 자체는 성공으로 본다 (다음 cron에서 다시 시도)
  await syncCalendar().catch((e) => console.error("google first sync", e));
  return back(req, "connected");
}
