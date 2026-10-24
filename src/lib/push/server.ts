// 웹 푸시 보내기 (VAPID). 구독은 push_subscriptions 표에 저장한다.
import webpush from "web-push";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

const { pushSubscriptions } = schema;

/** 서비스 워커(public/sw.js)가 받는 모양 */
export type PushPayload = {
  title: string;
  body: string;
  /** 알림을 누르면 열 주소 (기본 "/") */
  url?: string;
  /** 같은 tag의 알림은 새 것으로 바뀐다 */
  tag?: string;
  /** 알림 버튼. 미결정 공고: [{action:"apply",title:"지원할래요"},{action:"skip",title:"관심 없음"}] */
  actions?: { action: "apply" | "skip" | "open"; title: string }[];
  /** 버튼을 눌렀을 때 쓸 값 */
  postingId?: string;
};

export type PushSubscriptionJSON = { endpoint: string; keys: { p256dh: string; auth: string } };

let configured = false;
function configure() {
  if (configured) return;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) throw new Error("VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY가 설정되지 않았다");
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", pub, priv);
  configured = true;
}

export function vapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

export async function saveSubscription(sub: PushSubscriptionJSON): Promise<void> {
  await db.insert(pushSubscriptions).values({ endpoint: sub.endpoint, keys: sub.keys })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { keys: sub.keys } });
}

export async function removeSubscription(endpoint: string): Promise<void> {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}

/** 모든 기기에 보낸다. 만료된 구독(404/410)은 지운다. */
export async function sendToAll(payload: PushPayload): Promise<{ sent: number; removed: number; failed: number }> {
  configure();
  const subs = await db.select().from(pushSubscriptions);
  const r = { sent: 0, removed: 0, failed: 0 };
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload), { TTL: 60 * 60 * 12, urgency: "normal" });
      r.sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {
        await removeSubscription(s.endpoint);
        r.removed++;
      } else {
        console.error("push failed", code, (e as Error).message);
        r.failed++;
      }
    }
  }));
  return r;
}
