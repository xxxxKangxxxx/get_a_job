// 구글 OAuth 설정. 값은 .env.local / Vercel 환경변수에서만 읽는다.

export const SCOPES = [
  // 내 캘린더의 바쁜 시간만 읽기 (제목·내용은 못 봄)
  "https://www.googleapis.com/auth/calendar.freebusy",
  // 이 앱이 만든 캘린더("취업 일정")만 만들고 고치기
  "https://www.googleapis.com/auth/calendar.app.created",
  // 연결한 계정 이메일 표시용
  "openid",
  "email",
];

export const APP_CALENDAR_NAME = "취업 일정";
export const TIME_ZONE = "Asia/Seoul";

export function googleConfig(origin: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET이 설정되지 않았다");
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${origin}/api/google/callback`;
  return { clientId, clientSecret, redirectUri };
}

export function isGoogleConfigured(): boolean {
  return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
}
