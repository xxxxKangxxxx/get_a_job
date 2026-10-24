# 인프라 세션 인수인계

먼저 `docs/handoff/README.md`, `docs/PLAN.md`, `docs/handoff/STATUS.md`, `AGENTS.md`(Next.js 16은 바뀐 점이 많다 — `node_modules/next/dist/docs/` 확인)를 읽는다.

## 현재 상태 (총괄 세션이 만든 것)
- Next.js 16.4 + Tailwind v4 + pnpm. `next.config.ts`에 `cacheComponents: true` (DB 읽는 컴포넌트는 Suspense 필요). 미들웨어는 `src/proxy.ts`(이름 바뀜).
- DB: Drizzle. `src/db/schema.ts`, `src/db/index.ts` — `DATABASE_URL` 있으면 Neon(neon-http), 없으면 로컬 PGlite(`.pglite/`). neon-http는 대화형 트랜잭션이 없다.
- 마이그레이션 `drizzle/0000_init.sql`, 실행 `pnpm tsx scripts/migrate.ts`. 데이터 동기화 `pnpm tsx scripts/sync.ts` (로컬에서 검증 완료: 공고 595 / 진행중 71 / 지원현황 25).
- 일정 엔진 `src/lib/schedule.ts` (테스트 `pnpm vitest run`).

## 해야 할 일 (순서대로)
1. **Neon**: 사용자가 neon.tech에서 프로젝트를 만들고 `.env.local`에 `DATABASE_URL`을 넣는다(사용자에게 안내, 값은 받지 않는다). 그 뒤 migrate + sync를 Neon에 실행해 건수 확인.
2. **인증**: `APP_PASSWORD` 하나로 잠그는 `src/proxy.ts` + `/login`. 서명 쿠키(HMAC). `/api/cron/*`은 `CRON_SECRET` 헤더로 따로 인증. (로그인 화면 UI는 최소한으로만 — 디자인은 나중에 총괄이 입힌다.)
3. **Vercel 배포**: GitHub 저장소 연결(사용자 승인 후), 환경변수 설정, Neon 연결. `.env.example` 작성.
4. **구글 캘린더 연동** (`src/lib/google/`, `src/app/api/google/`):
   - OAuth 2.0 (Google Cloud 프로젝트 생성·동의 화면·클라이언트 ID는 사용자와 단계별 진행). 범위: 캘린더 읽기(FreeBusy) + 앱 전용 캘린더 쓰기. 테스트 모드의 refresh token 7일 만료 문제 → 앱을 "프로덕션"으로 게시(미인증 경고 감수)하는 방법 안내.
   - 앱 전용 캘린더 "취업 일정" 생성, 이벤트 upsert/삭제(앱 이벤트 id ↔ 구글 이벤트 id 매핑 테이블 필요).
   - FreeBusy로 날짜별 바쁜 시간 → 일정 엔진의 `Settings.overrides`(날짜별 가용 시간)에 쓸 수 있는 함수 제공.
   - 캘린더 표시 규칙: 전형별 접수 기간(기본 서류 접수 기간, 전형이 진행되면 현재 단계 일정만) + 작업 블록(시간대 배치). 미결정 공고는 캘린더에 넣지 않는다.
5. **웹 푸시** (`src/lib/push/`): VAPID, 구독 저장(`push_subscriptions` 테이블 있음), 서비스 워커 `public/sw.js`, 알림 액션 버튼(미결정 공고 "지원/관심없음"). iOS는 홈 화면 추가 후에만 동작.
6. **cron** (`src/app/api/cron/`): 아침 브리핑(08:00 KST), 구글 캘린더 동기화, 미결정 A급 공고 알림. Vercel Hobby는 하루 1회 제한 → 필요하면 GitHub Actions cron.

## 경계
- 화면(UI)은 만들지 않는다. 필요한 API·서버 함수만 만들고 사용법을 `docs/infra/`에 적는다.
- 스키마 추가가 필요하면 새 테이블만 추가하고(기존 테이블 수정 금지) 마이그레이션을 생성, STATUS.md에 적는다.
- 외부 서비스에 무언가를 만들거나 배포·푸시하기 전에 사용자에게 확인받는다.
