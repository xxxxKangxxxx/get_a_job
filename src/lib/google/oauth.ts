// OAuth 2.0: 동의 화면 주소 만들기, code ↔ 토큰 교환, 액세스 토큰 갱신·저장.
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { googleAccounts, type GoogleAccount } from "@/db/schema-infra";
import { SCOPES, googleConfig } from "./config";

const ACCOUNT_ID = "me";

export function authUrl(origin: string, state: string): string {
  const { clientId, redirectUri } = googleConfig(origin);
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", SCOPES.join(" "));
  u.searchParams.set("access_type", "offline"); // refresh token 받기
  u.searchParams.set("prompt", "consent"); // 다시 연결할 때도 refresh token을 새로 받기
  u.searchParams.set("include_granted_scopes", "true");
  u.searchParams.set("state", state);
  return u.toString();
}

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  id_token?: string;
};

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const json = await res.json();
  if (!res.ok) throw new GoogleAuthError(json.error_description || json.error || `token ${res.status}`, json.error);
  return json as TokenResponse;
}

export class GoogleAuthError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
  }
}

function emailFromIdToken(idToken?: string): string | null {
  if (!idToken) return null;
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf-8"));
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}

/** 콜백에서 받은 code로 토큰을 받아 저장한다 */
export async function exchangeCode(origin: string, code: string): Promise<GoogleAccount> {
  const { clientId, clientSecret, redirectUri } = googleConfig(origin);
  const t = await tokenRequest({
    code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code",
  });
  const existing = await getAccount();
  const refreshToken = t.refresh_token ?? existing?.refreshToken;
  if (!refreshToken) throw new GoogleAuthError("refresh token을 받지 못했다. 구글 계정의 앱 권한을 지우고 다시 연결해야 한다");
  const values = {
    id: ACCOUNT_ID,
    email: emailFromIdToken(t.id_token) ?? existing?.email ?? null,
    refreshToken,
    accessToken: t.access_token,
    accessTokenExpiresAt: new Date(Date.now() + (t.expires_in - 60) * 1000),
    scope: t.scope,
    lastSyncError: null,
    updatedAt: new Date(),
  };
  await db.insert(googleAccounts).values(values).onConflictDoUpdate({ target: googleAccounts.id, set: values });
  return (await getAccount())!;
}

export async function getAccount(): Promise<GoogleAccount | null> {
  const [row] = await db.select().from(googleAccounts).where(eq(googleAccounts.id, ACCOUNT_ID));
  return row ?? null;
}

export async function updateAccount(patch: Partial<GoogleAccount>): Promise<void> {
  await db.update(googleAccounts).set({ ...patch, updatedAt: new Date() }).where(eq(googleAccounts.id, ACCOUNT_ID));
}

/** 유효한 액세스 토큰. 만료됐으면 refresh token으로 새로 받는다 */
export async function getAccessToken(): Promise<string> {
  const acc = await getAccount();
  if (!acc) throw new GoogleAuthError("구글 캘린더가 연결되지 않았다", "not_connected");
  if (acc.accessToken && acc.accessTokenExpiresAt && acc.accessTokenExpiresAt.getTime() > Date.now()) return acc.accessToken;
  const { clientId, clientSecret } = googleConfig("http://unused");
  try {
    const t = await tokenRequest({
      refresh_token: acc.refreshToken, client_id: clientId, client_secret: clientSecret, grant_type: "refresh_token",
    });
    await updateAccount({
      accessToken: t.access_token,
      accessTokenExpiresAt: new Date(Date.now() + (t.expires_in - 60) * 1000),
      ...(t.refresh_token ? { refreshToken: t.refresh_token } : {}),
    });
    return t.access_token;
  } catch (e) {
    // invalid_grant: 사용자가 권한을 끊었거나, 테스트 모드라 7일이 지나 만료됨 → 다시 연결 필요
    if (e instanceof GoogleAuthError && e.code === "invalid_grant") {
      await updateAccount({ lastSyncError: "다시 연결이 필요해요 (구글 권한이 만료됨)" });
    }
    throw e;
  }
}

/** 연결 끊기: 구글 쪽 권한도 취소하고 저장된 계정·매핑을 지운다 */
export async function disconnect(): Promise<void> {
  const acc = await getAccount();
  if (!acc) return;
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(acc.refreshToken)}`, { method: "POST" }).catch(() => {});
  await db.delete(googleAccounts).where(eq(googleAccounts.id, ACCOUNT_ID));
}
