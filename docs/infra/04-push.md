# 5단계: 웹 푸시 알림 준비

## 1. VAPID 키 만들기 (사용자, 터미널 1분)
infra 폴더에서:
```
cd /Users/kang-yeongmo/orca/workspaces/get_a_job/infra
pnpm exec web-push generate-vapid-keys
```
나온 Public Key / Private Key를 `.env.local`과 Vercel 환경변수에 넣습니다 (채팅에 붙여넣지 않기).
```
VAPID_PUBLIC_KEY=…
VAPID_PRIVATE_KEY=…
VAPID_SUBJECT=mailto:내이메일
```
Vercel은 넣은 뒤 Redeploy.

## 2. 폰에서 알림 받기
- **아이폰**: Safari로 배포 주소 접속 → 로그인 → 공유 버튼 → **홈 화면에 추가** → 홈 화면 아이콘으로 연 앱에서 "알림 켜기" (iOS 16.4 이상, Safari 탭에서는 안 됨)
- **안드로이드/PC 크롬**: 그냥 접속해서 "알림 켜기"
- "알림 켜기" 버튼은 프론트엔드가 설정 화면에 만듭니다(`@/lib/push/client`의 `enablePush()`). 그 전에는 테스트용으로 브라우저 콘솔에서 확인합니다.
- 아이폰은 알림의 버튼(지원할래요/관심 없음)이 보이지 않을 수 있어요. 그때는 알림을 누르면 받은편지함이 열립니다.

## 3. 버튼이 아직 없을 때 테스트 (PC 크롬)
배포 주소에 로그인한 크롬 탭에서 F12 → Console에 붙여넣고 Enter → 알림 허용:
```js
const reg = await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready;
await Notification.requestPermission();
const { publicKey } = await (await fetch('/api/push/key')).json();
const b = s => Uint8Array.from(atob((s + '='.repeat((4 - s.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b(publicKey) });
await fetch('/api/push/subscribe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(sub) });
await (await fetch('/api/push/test', { method: 'POST' })).json();   // { sent: 1 } 이면 성공
```
macOS라면 시스템 설정 → 알림 → Google Chrome 알림이 켜져 있어야 화면에 보입니다.
