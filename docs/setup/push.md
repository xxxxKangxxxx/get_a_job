# 선택 기능: 웹 푸시 알림

매일 아침 브리핑과 "결정이 급한 공고" 알림을 폰·PC로 받습니다. 알림의 "지원할래요 / 관심 없음" 버튼으로 바로 결정할 수 있습니다.

## 키
`pnpm first-setup`이 `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`를 만들어 둡니다. 직접 만들려면 `pnpm exec web-push generate-vapid-keys`.
`VAPID_SUBJECT`는 `mailto:내이메일`. 배포했다면 Vercel 환경변수에도 넣고 Redeploy. 키가 없으면 알림은 그냥 건너뜁니다.

## 폰에서 받기
- **아이폰**(iOS 16.4+): Safari로 배포 주소 → 로그인 → 공유 → **홈 화면에 추가** → 홈 화면 아이콘으로 열어야 알림을 켤 수 있습니다.
- **안드로이드·PC 크롬**: 그냥 접속해서 켭니다.

## 지금 켜는 방법 (알림 켜기 버튼이 생기기 전)
배포 주소에 로그인한 크롬 탭에서 개발자 도구 Console에 붙여넣습니다:
```js
const reg = await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready;
await Notification.requestPermission();
const { publicKey } = await (await fetch('/api/push/key')).json();
const b = s => Uint8Array.from(atob((s + '='.repeat((4 - s.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b(publicKey) });
await fetch('/api/push/subscribe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(sub) });
await (await fetch('/api/push/test', { method: 'POST' })).json();   // { sent: 1 } 이면 성공
```
