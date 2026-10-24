// 비밀번호 하나(APP_PASSWORD)로 잠그는 로그인 세션.
// 쿠키 값 = "<만료 시각(ms)>.<HMAC-SHA256 서명>". 서명 키는 SESSION_SECRET(없으면 APP_PASSWORD).
// 비밀번호나 SESSION_SECRET을 바꾸면 기존 로그인은 모두 풀린다.
// proxy(Node 런타임)와 라우트 핸들러 양쪽에서 쓰므로 Web Crypto만 사용한다.

export const SESSION_COOKIE = "gaj_session";
export const SESSION_DAYS = 30;

const enc = new TextEncoder();

function secret(): string | null {
  return process.env.SESSION_SECRET || process.env.APP_PASSWORD || null;
}

async function hmac(key: string, data: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(data)));
  return Buffer.from(sig).toString("base64url");
}

/** 길이와 상관없이 일정한 시간에 비교한다 */
export function safeEqual(a: string, b: string): boolean {
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export async function createSessionValue(now = Date.now()): Promise<string> {
  const key = secret();
  if (!key) throw new Error("APP_PASSWORD가 설정되지 않았다");
  const exp = String(now + SESSION_DAYS * 86400_000);
  return `${exp}.${await hmac(key, exp)}`;
}

export async function verifySessionValue(value: string | undefined, now = Date.now()): Promise<boolean> {
  const key = secret();
  if (!key || !value) return false;
  const [exp, sig] = value.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < now) return false;
  return safeEqual(sig, await hmac(key, exp));
}

export function checkPassword(input: string): boolean {
  const pw = process.env.APP_PASSWORD;
  return !!pw && safeEqual(input, pw);
}

/** Vercel Cron은 "Authorization: Bearer <CRON_SECRET>"을 보낸다. GitHub Actions도 같은 헤더를 쓴다. */
export function checkCronAuth(authorization: string | null): boolean {
  const s = process.env.CRON_SECRET;
  return !!s && !!authorization && safeEqual(authorization, `Bearer ${s}`);
}

/** 로그인 후 돌아갈 주소. 외부 주소로는 보내지 않는다. */
export function safeNext(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}
