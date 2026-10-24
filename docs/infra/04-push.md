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
