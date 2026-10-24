// 브라우저에서 쓰는 푸시 도우미. 클라이언트 컴포넌트에서 import한다.
//   import { enablePush, disablePush, pushState } from "@/lib/push/client";
//   설정 화면의 "알림 켜기" 버튼 onClick에서 await enablePush()  (반드시 사용자 클릭 안에서 불러야 한다)
// iOS는 Safari "홈 화면에 추가"로 연 앱에서만 동작한다 (iOS 16.4+).

export type PushState = "unsupported" | "needs-install" | "denied" | "off" | "on";

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}
function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

export async function pushState(): Promise<PushState> {
  if (typeof window === "undefined") return "unsupported";
  if (isIos() && !isStandalone()) return "needs-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  return sub ? "on" : "off";
}

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** 권한 요청 → 구독 → 서버 저장. 성공하면 "on" */
export async function enablePush(): Promise<PushState> {
  const state = await pushState();
  if (state === "unsupported" || state === "needs-install" || state === "denied") return state;
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return perm === "denied" ? "denied" : "off";
  const reg = (await registerServiceWorker())!;
  await navigator.serviceWorker.ready;
  const { publicKey } = await fetch("/api/push/key").then((r) => r.json());
  if (!publicKey) throw new Error("서버에 VAPID 키가 없어요");
  const sub = (await reg.pushManager.getSubscription())
    ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) }));
  const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
  if (!res.ok) throw new Error("구독 저장 실패");
  return "on";
}

export async function disablePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await fetch("/api/push/subscribe", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
    await sub.unsubscribe();
  }
  return "off";
}

/** 테스트 알림 보내기 (모든 기기) */
export async function sendTestPush(): Promise<{ sent: number }> {
  return fetch("/api/push/test", { method: "POST" }).then((r) => r.json());
}
