# 배포하기 (Neon + Vercel, 무료 플랜으로 충분)

로컬에서 써 보기만 할 거면 이 단계는 필요 없습니다(`pnpm dev`는 로컬 DB를 씁니다). 폰에서 보거나 매일 아침 알림·동기화를 쓰려면 배포합니다.

## 1. Neon (DB)
1. https://neon.tech 가입 → **New Project** (지역은 가까운 곳, 예: Singapore)
2. **Connect** → 연결 문자열(`postgresql://…?sslmode=require`)을 복사
3. 로컬 `.env.local`의 `DATABASE_URL=`에 붙여넣기 (채팅이나 git에 올리지 않기)
4. 터미널에서:
   ```bash
   pnpm db:migrate   # Neon에 표 만들기
   pnpm sync         # data/postings.json의 공고를 Neon에 넣기
   ```

## 2. GitHub에 내 사본 만들기
이 저장소를 **Fork**(또는 "Use this template")해서 내 계정에 둡니다. 비공개로 둬도 됩니다.
내 데이터(`data/`, `.env.local`)는 git에 올라가지 않습니다.

## 3. Vercel
1. https://vercel.com 가입(GitHub 계정) → **Add New → Project** → 내 사본 저장소 **Import**
2. **Environment Variables**에 `.env.local`의 값을 옮깁니다. 최소한:
   `DATABASE_URL`, `APP_PASSWORD`, `SESSION_SECRET`, `CRON_SECRET`
   (쓰는 선택 기능의 값도 같이: 푸시 `VAPID_*`, 구글 `GOOGLE_*`, justdo `JUSTDO_*`, `CONTACT_EMAIL`)
3. **Deploy**. 배포할 때마다 DB 마이그레이션이 자동으로 돕니다(`vercel-build`).
4. 배포 주소가 나오면 `APP_URL`에 넣고 **Redeploy**.

`vercel.json`의 `regions`(기본 `sin1` 싱가포르)는 Neon 지역과 가깝게 맞추면 빠릅니다.

## 매일 아침 작업
`vercel.json`의 cron이 매일 08:00(한국 시간)에 `/api/cron/daily`를 부릅니다:
구글 캘린더 동기화 → justdo 동기화 → 아침 브리핑 알림 → 결정이 급한 공고 알림. 설정하지 않은 기능은 건너뜁니다.

## 업데이트 받기
원본 저장소에 새 기능이 생기면 내 사본에서 **Sync fork**(또는 `git pull upstream main`) → push하면 Vercel이 다시 배포하고 마이그레이션도 자동으로 됩니다.
