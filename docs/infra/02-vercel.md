# 3단계: GitHub 저장소 + Vercel 배포 (사용자가 직접, 일부는 작업자가 승인 후)

## A. GitHub 저장소 (사용자)
1. https://github.com/new 에서 저장소를 만듭니다.
   - 이름: `get_a_job`, **Private**(비공개) 선택, README·.gitignore 추가는 **체크하지 않음**
2. 만든 저장소 주소(예: `https://github.com/아이디/get_a_job`)만 알려 주세요.
3. 총괄이 브랜치를 병합한 뒤, 승인받고 `main`을 이 저장소에 푸시합니다. (작업자는 승인 없이 푸시하지 않습니다)

## B. Vercel 프로젝트 (사용자)
1. https://vercel.com 에 GitHub 계정으로 가입(Hobby, 무료).
2. **Add New → Project** → 방금 만든 `get_a_job` 저장소 **Import**.
   - Framework: Next.js (자동), Build Command·Install Command 기본값 그대로 (pnpm 자동 인식)
3. **Environment Variables**에 아래를 넣습니다 (값은 `.env.local`과 같게, 채팅에 붙여넣지 않기).
   | 이름 | 값 |
   |---|---|
   | `DATABASE_URL` | Neon 연결 문자열 (1단계) |
   | `APP_PASSWORD` | 앱 비밀번호 (직접 정하기) |
   | `SESSION_SECRET` | 터미널에서 `openssl rand -base64 32` 결과 |
   | `CRON_SECRET` | 터미널에서 `openssl rand -base64 32` 결과 (다른 값) |
   | `APP_URL` | 배포 주소 (예: `https://get-a-job-xxx.vercel.app`) — 첫 배포 후 넣고 Redeploy |
   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | 4단계 후 |
   | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | 5단계 후 |
4. **Deploy**. 끝나면 주소(`https://….vercel.app`)를 알려 주세요.
5. 환경변수를 나중에 추가·변경하면 **Deployments → 최신 배포 ⋯ → Redeploy** 해야 반영됩니다.

> Neon을 Vercel Marketplace(Storage → Neon)로 연결해도 되지만, 이미 만든 Neon DB가 있으니 `DATABASE_URL`만 직접 넣는 쪽이 간단합니다.

## C. 확인 (작업자)
- 배포 주소 → `/login`으로 넘어가는지, 비밀번호로 들어가지는지
- `curl -H "Authorization: Bearer <CRON_SECRET>" https://…/api/cron/daily` 가 200인지 (사용자가 직접 실행하거나 작업자가 .env.local 값으로 실행)
- Vercel → Settings → Cron Jobs 에 `/api/cron/daily` (매일 23:00 UTC = 08:00 KST) 가 보이는지

## 데이터 동기화
`채용공고_데이터.json`은 내 Mac에만 있으므로 동기화는 Mac에서 실행합니다.
`.env.local`에 `DATABASE_URL`(Neon)이 있으면 `pnpm tsx scripts/sync.ts` 가 바로 Neon에 반영됩니다.
