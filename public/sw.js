// 서비스 워커: 웹 푸시 받기 + 알림 버튼 처리.
// payload 모양은 src/lib/push/server.ts 의 PushPayload.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let p = {};
  try { p = event.data ? event.data.json() : {}; } catch { p = { title: "알림", body: event.data ? event.data.text() : "" }; }
  event.waitUntil(self.registration.showNotification(p.title || "취업 일정", {
    body: p.body || "",
    tag: p.tag,
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-72.png",
    actions: (p.actions || []).slice(0, 2),
    data: { url: p.url || "/", postingId: p.postingId || null },
  }));
});

async function openOrFocus(url) {
  const target = new URL(url, self.location.origin).href;
  const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const w of wins) {
    if (w.url === target && "focus" in w) return w.focus();
  }
  if (wins[0] && "navigate" in wins[0]) {
    await wins[0].navigate(target);
    return wins[0].focus();
  }
  return self.clients.openWindow(target);
}

self.addEventListener("notificationclick", (event) => {
  const n = event.notification;
  const { url, postingId } = n.data || {};
  n.close();
  if ((event.action === "apply" || event.action === "skip") && postingId) {
    event.waitUntil((async () => {
      const res = await fetch("/api/push/decide", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ postingId, action: event.action }),
      }).catch(() => null);
      // 로그인이 풀렸거나 실패하면 앱을 열어 직접 고르게 한다
      if (!res || !res.ok) return openOrFocus(url || "/");
      await self.registration.showNotification(event.action === "apply" ? "지원 예정에 넣었어요" : "관심 없음으로 넘겼어요", {
        tag: `decided-${postingId}`, body: "", data: { url: url || "/" },
      });
    })());
    return;
  }
  event.waitUntil(openOrFocus(url || "/"));
});
