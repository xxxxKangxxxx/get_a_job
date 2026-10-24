# 인프라 동작 확인 기록

## 1. Neon — 2026-10-24
- 사용자가 Neon 프로젝트 `get-a-job`(AWS Singapore) 생성, `.env.local`에 `DATABASE_URL`(pooled) 저장.
- `pnpm tsx scripts/migrate.ts` → "마이그레이션 완료 (Neon)"
- `pnpm tsx scripts/sync.ts` 후 건수: **공고 595 / 진행중 71 / 지원현황 25 / 일정 1**, 중복 id 0
- sync 한 번 더 실행 → 건수 그대로 (중복 없음)
- Vercel 함수 지역을 Neon과 가깝게 `vercel.json` `regions: ["sin1"]`

## 2. 인증 (APP_PASSWORD 잠금) — 2026-10-24 로컬 확인
테스트용 값(`APP_PASSWORD=test-pw`, `CRON_SECRET=test-cron`)으로 `next dev` 후 curl:

| 요청 | 결과 |
|---|---|
| 로그인 없이 `/` | 307 → `/login` |
| 로그인 없이 `/schedule?x=1` | 307 → `/login?next=%2Fschedule%3Fx%3D1` |
| 로그인 없이 `/api/google/status` | 401 `{"error":"unauthorized"}` |
| 틀린 비밀번호 POST `/api/auth/login` | 1초 지연 후 303 → `/login?error=1&next=%2Fschedule`, 화면에 "비밀번호가 맞지 않아요" |
| 맞는 비밀번호 + `next=//evil.com` | 303 → `/` (외부 주소로 안 보냄), `gaj_session` 쿠키 발급 |
| 쿠키로 `/` | 200 |
| 위조 쿠키 | 307 → `/login` |
| `/api/cron/*` 헤더 없음 / 로그인 쿠키만 | 401 / 401 |
| `/api/cron/*` `Authorization: Bearer <CRON_SECRET>` | 통과 (라우트 생기기 전이라 404) |

## 3. Vercel 배포
(GitHub 저장소·Vercel 프로젝트 사용자 준비 대기 중 — 안내문 `02-vercel.md`)
- `vercel.json`: 함수 지역 `sin1`(Neon 싱가포르와 같은 곳), cron `/api/cron/daily` 매일 23:00 UTC(08:00 KST)
- `pnpm build` (DATABASE_URL 더미) 통과. 모든 `/api/*`는 요청 시 실행(ƒ), `/login`은 부분 프리렌더(◐)

## 4. 구글 캘린더 — 로컬 확인 (구글 연결 전)
- `vitest`: FreeBusy → 한국 날짜별 분할(자정 넘김, 하루 전체 = null), 작업 시간대 배치(바쁜 시간 피하기·쪼개기·넘침), 접수 기간은 "예정"만(미결정·보류 제외), 전형 일정(마감 종류 제외) — 통과
- 임시 로컬 DB에서 `replaceGoogleBusy` 두 번 실행 → google 행만 교체, 수동 행 유지, 중복 없음. `meta.calendar_status` = `{connected:false,lastSyncAt:null}` 기록 확인
- `/api/google/status` → `{"connected":false,…}`, `/api/google/connect` → GOOGLE_* 없으면 500 (정상)
- (구글 클라우드 설정·연결 후 테스트 이벤트 확인 예정)

## 5·6. 웹 푸시 / cron — 로컬 확인 (테스트 VAPID 키)
| 요청 | 결과 |
|---|---|
| `GET /api/cron/daily` (CRON_SECRET) | `{"ok":true,"googleSync":{"skipped":"구글 캘린더 미연결"},"briefing":{"sent":0},"decisions":{"prompts":1,"sent":0}}` |
| `GET /api/cron/briefing`, `/google-sync`, `/decisions` | 각각 200 |
| `GET /api/push/key` | 공개키 반환 |
| `POST /api/push/subscribe` 잘못된 body | 400 "잘못된 구독 정보" |
| 가짜 FCM 구독 저장 후 `POST /api/push/test` | `{"sent":0,"removed":1}` — 만료(404/410) 구독 자동 삭제 |
| `POST /api/push/decide` | `decideInbox` 호출 `{"ok":true}` |
| `GET /sw.js` 로그인 없이 | 200 (서비스 워커는 잠그지 않음) |
- (배포 후 실제 폰 테스트 푸시 확인 예정)

## master 병합 후 (백엔드 실제 구현 + Neon) — 2026-10-24
- `git merge master` 후 `busy_blocks`는 drizzle `schema.busyBlocks`로 쓰도록 변경. `tsc` 통과, `vitest` 34개 통과, `pnpm build` 통과.
- 로컬 dev(Neon 연결) `GET /api/cron/daily` → `{"ok":true, googleSync: 미연결 건너뜀, briefing: sent 0 (구독 없음), decisions: prompts 3}` — 실제 데이터에서 미결정 A급 "지원할까요?" 알림 3건 생성.
