# 백엔드 작업자 인수인계

먼저 `docs/handoff/README.md`, `docs/DECISIONS.md`, `AGENTS.md`(Next.js 16 주의)를 읽는다.

## 이미 있는 것
- 스키마 `src/db/schema.ts`, 클라이언트 `src/db/index.ts`(DATABASE_URL 없으면 로컬 PGlite `.pglite/` — 한 번에 한 프로세스만), 마이그레이션 `drizzle/0000_init.sql`, `pnpm tsx scripts/migrate.ts`.
- 동기화 `scripts/sync.ts` — 원본 JSON → DB, 앱에서 고친 필드(`userEditedFields`) 보존 검증됨. 공고 595 / 진행중 71 / 지원현황 25.
- 일정 엔진 `src/lib/schedule.ts` + `schedule.test.ts` (`pnpm vitest run`). EDF 배분, 위험·포기 후보, 면접 준비 시간.
- 날짜 유틸 `src/lib/date.ts` (한국 시간 "YYYY-MM-DD").
- **약속**: `src/contracts/types.ts`, 지금은 가짜 데이터를 돌려주는 `src/server/queries.ts`·`actions.ts`·`mock.ts`.

## 목표
`src/server/queries.ts`와 `actions.ts`를 **같은 함수 이름·인자·반환 모양 그대로** 실제 DB 구현으로 바꾸고 `mock.ts`를 지운다.

## 작업 순서
1. **스키마 보강** (새 마이그레이션 생성 OK — 백엔드가 스키마 담당):
   - 받은편지함: postings에 `inboxState`(new | seen) 또는 별도 테이블, `decidedAt`, 결정 되돌리기용 이전 값.
   - 숨김 규칙 `hide_rules`(kind, value, createdAt) — D13. 동기화 때 새 공고가 규칙에 맞으면 자동 숨김(받은편지함에 안 뜨고 `autoHidden`으로 집계).
   - 설정은 `meta` 테이블 key `settings`(`AppSettings`), 기본값은 DECISIONS D5.
   - 오늘 할 일 체크 상태: `daily_plans.checked` 활용 또는 새 테이블.
   - 캘린더 바쁜 시간: 인프라가 넣을 자리. `busy_blocks`(date, start, end, title, source) 테이블을 만들어 두고, 일정 계산은 이 표를 읽는다(인프라는 이 표를 채우기만 한다). 지금은 비어 있어도 동작해야 한다.
2. **동기화 개선**: 새로 들어온 공고는 받은편지함(new)으로, 숨김 규칙 적용, 지원여부 '' 유지.
3. **일정 계산 연결** (`src/server/plan.ts` 같은 곳):
   - "예정" 공고 → WorkItem(남은 시간 = (estHours ?? 기본값) × (1 − progress/100), due = 마감 − bufferDays, 마감 지난 것 제외, 수시는 soft).
   - 면접·인적성 일정 → 준비 WorkItem (D7, `prepFor`).
   - 날짜별 가용 시간 = 설정(평일/주말/overrides) − busy_blocks 합.
   - 결과를 `TodayView`, `ScheduleView`, `Warning`(몰린 마감일별로 묶기, fixes = 포기 후보 + addHours 제안), `InboxImpact`(이 공고를 예정으로 넣고 다시 계산했을 때 기존 공고 중 새로 위험해지는 게 있는지)로 변환.
   - `TodayTask.progressTo` = progress + 오늘 시간/예상 시간×100 (최대 100).
4. **queries.ts 구현**: getToday, getSchedule, getInbox(정렬: needDecision 먼저 → 마감 빠른 순), getBoard(meta.전형칼럼 매핑 + "준비 중" = 예정 공고), listPostings(필터·정렬·페이지), getPosting, getSettings, listHideRules.
5. **actions.ts 구현**: 각 함수 주석대로. 끝나면 `revalidatePath`(Next 16 문서 확인: `node_modules/next/dist/docs/`). 앱에서 바꾼 필드는 `userEditedFields`에 추가.
6. **테스트**: 일정 변환·받은편지함 영향·숨김 규칙에 vitest 테스트. 로컬 PGlite에 migrate + sync 후 queries를 실행하는 스크립트로 실제 데이터 결과 확인(오늘 할 일·경고가 말이 되는지).

## 경계
- 화면(`src/app/` 페이지·컴포넌트)은 만들지 않는다.
- 약속(`src/contracts/types.ts`)을 바꿔야 하면 총괄에게 `ask`.
- 구글 API·푸시 코드는 인프라 담당. 백엔드는 `busy_blocks`를 읽기만.
- Claude API로 공고 붙여넣기 추출(`extractPosting`)은 이번 범위 밖(다음 작업).

## 완료 기준
`pnpm vitest run` 통과, `pnpm tsc --noEmit` 통과, 로컬 DB로 getToday()/getInbox()/getBoard() 실제 결과 샘플을 보고서에 첨부, `mock.ts` 삭제.
