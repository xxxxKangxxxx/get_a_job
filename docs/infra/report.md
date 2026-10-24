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

## 3. Vercel 배포 — 2026-10-24
- 저장소 https://github.com/xxxxKangxxxx/get_a_job (비공개, 총괄이 main 푸시), 사용자가 Vercel Import → **https://get-a-job-indol.vercel.app**
- Production 환경변수: DATABASE_URL·APP_PASSWORD·SESSION_SECRET·CRON_SECRET·APP_URL·GOOGLE_CLIENT_ID/SECRET·VAPID_* (총괄 확인)
- 배포 확인(총괄+작업자): `/` → 307 `/login`, 비밀번호 로그인 303 → `/` 200, `/api/cron/daily` 무인증 401, CRON_SECRET로 200, `/sw.js` 무로그인 200
- `/privacy`(구글 동의 화면용 개인정보처리방침) 무로그인 200, 내용 확인
- `vercel.json`: 함수 지역 `sin1`(Neon 싱가포르와 같은 곳), cron `/api/cron/daily` 매일 23:00 UTC(08:00 KST)
- `pnpm build` (DATABASE_URL 더미) 통과. 모든 `/api/*`는 요청 시 실행(ƒ), `/login`은 부분 프리렌더(◐)

## 4. 구글 캘린더 — 로컬 확인 (구글 연결 전)
- `vitest`: FreeBusy → 한국 날짜별 분할(자정 넘김, 하루 전체 = null), 작업 시간대 배치(바쁜 시간 피하기·쪼개기·넘침), 접수 기간은 "예정"만(미결정·보류 제외), 전형 일정(마감 종류 제외) — 통과
- 임시 로컬 DB에서 `replaceGoogleBusy` 두 번 실행 → google 행만 교체, 수동 행 유지, 중복 없음. `meta.calendar_status` = `{connected:false,lastSyncAt:null}` 기록 확인
- `/api/google/status` → `{"connected":false,…}`, `/api/google/connect` → GOOGLE_* 없으면 500 (정상)

### 구글 연결 후 (배포) — 2026-10-24
- 사용자가 `/api/google/connect`로 연결: 계정 kang071911@gmail.com, 범위 `calendar.freebusy` + `calendar.app.created` + openid/email, "취업 일정" 캘린더 생성, `lastSyncError` 없음
- 배포에서 `GET /api/cron/google-sync` → `{"busyRows":0,"created":0,"updated":0,"deleted":0,"unchanged":0}` 200
- **busy_blocks 0건 점검**: FreeBusy를 직접 호출 — primary, 기간 2026-10-24~11-22(KST), 오류 없음, 바쁜 구간 0개. 범위를 2026-09-01~10-24로 넓혀도 0개 → 기간 계산 문제가 아니라 **기본 캘린더에 바쁜 일정이 없음**. 개인 일정이 다른 캘린더에 있으면 `GOOGLE_BUSY_CALENDARS`에 캘린더 ID를 넣으면 됨(`03-google.md` 7절). 종일·"한가함" 일정은 구글이 바쁨으로 치지 않음. 캘린더 id가 틀린 경우 조용히 0건이 되지 않도록 FreeBusy `errors`를 오류로 올리게 고침.
- **이벤트 0건 점검**: 진행중 71건이 모두 미결정('')이고 "예정" 0건, 전형 일정은 지난 1건(10/04 인적성)뿐 → 캘린더에 넣을 것이 없음(D10: 미결정은 넣지 않음). 정상.
- **테스트 이벤트**: "취업 일정"에 `✍️ 인프라 테스트 이벤트` 2026-10-25 19:00~20:00 KST 생성 → 조회 status `confirmed`, 시각 일치 → 삭제 후 `cancelled`. 쓰기 경로 정상.
- 공고를 "예정"으로 바꾸면 다음 동기화(매일 08:00 또는 `POST /api/google/sync`)에 접수 기간·작업 블록이 생긴다.

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
- 실제 기기 테스트 푸시: 총괄 결정으로 프론트 설정 화면(알림 켜기 버튼) 생긴 뒤로 미룸. 그 전엔 `04-push.md` 3절 콘솔 방법으로 가능.

## master 병합 후 (백엔드 실제 구현 + Neon) — 2026-10-24
- `git merge master` 후 `busy_blocks`는 drizzle `schema.busyBlocks`로 쓰도록 변경. `tsc` 통과, `vitest` 34개 통과, `pnpm build` 통과.
- 로컬 dev(Neon 연결) `GET /api/cron/daily` → `{"ok":true, googleSync: 미연결 건너뜀, briefing: sent 0 (구독 없음), decisions: prompts 3}` — 실제 데이터에서 미결정 A급 "지원할까요?" 알림 3건 생성.
