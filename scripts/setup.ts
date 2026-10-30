// 처음 설치할 때 한 번: .env.local을 만들고 비밀값을 채운다.  사용법: pnpm first-setup [--email 내@메일]
// 이미 .env.local이 있으면 비어 있는 값만 채우고, 있는 값은 건드리지 않는다.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import webpush from "web-push";

const ENV = ".env.local";
const emailArg = process.argv.indexOf("--email");
const email = emailArg > 0 ? process.argv[emailArg + 1] : "";

const secret = () => randomBytes(32).toString("base64url");
const password = () => randomBytes(9).toString("base64url");

const current = existsSync(ENV) ? readFileSync(ENV, "utf-8") : readFileSync(".env.example", "utf-8");
const has = (k: string) => new RegExp(`^${k}=.+$`, "m").test(current);

const vapid = webpush.generateVAPIDKeys();
const fill: Record<string, string> = {
  APP_PASSWORD: password(),
  SESSION_SECRET: secret(),
  CRON_SECRET: secret(),
  VAPID_PUBLIC_KEY: vapid.publicKey,
  VAPID_PRIVATE_KEY: vapid.privateKey,
  VAPID_SUBJECT: email ? `mailto:${email}` : "",
  CONTACT_EMAIL: email,
};
// 공개·비공개 키는 짝이라 둘 중 하나라도 있으면 둘 다 그대로 둔다
if (has("VAPID_PUBLIC_KEY") || has("VAPID_PRIVATE_KEY")) { delete fill.VAPID_PUBLIC_KEY; delete fill.VAPID_PRIVATE_KEY; }

let out = current;
const filled: string[] = [];
for (const [k, v] of Object.entries(fill)) {
  if (!v || has(k)) continue;
  const re = new RegExp(`^${k}=.*$`, "m");
  out = re.test(out) ? out.replace(re, `${k}=${v}`) : `${out.trimEnd()}\n${k}=${v}\n`;
  filled.push(k);
}
writeFileSync(ENV, out);

console.log(filled.length ? `${ENV}에 채움: ${filled.join(", ")}` : `${ENV}: 채울 값 없음`);
if (filled.includes("APP_PASSWORD")) {
  console.log(`\n앱 비밀번호: ${fill.APP_PASSWORD}\n(${ENV}의 APP_PASSWORD. 바꾸려면 그 값을 고친다)`);
}
if (!has("DATABASE_URL")) console.log("\nDATABASE_URL이 비어 있어 로컬 개발 DB(.pglite/)를 쓴다. 배포할 때는 Neon 주소를 넣는다.");
