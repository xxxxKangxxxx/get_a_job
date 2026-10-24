# 취업 준비 웹앱 — 구현 계획

## Context
지금은 `/Users/kang-yeongmo/2026 취업하기/` 에서 Claude가 4개 사이트(자소설·사람인·링커리어·잡코리아)를 조사해 `채용공고_데이터.json`(공고 595건·지원현황 25건, 24회차)을 갱신하고, `_tools/build_dashboard.py` 가 이를 `채용_대시보드.html` 한 파일로 굽는다. 매번 폴더에 들어가 열어야 하고, 직접 찾은 공고를 넣기 번거로우며, 폰에서 볼 수 없다.

목표: 폰·PC 어디서나 여는 개인용 웹앱(PWA). 기존 데이터 체계(적합도 A/B/C, 지원여부, 14개 전형단계)를 그대로 옮기고, 공고 붙여넣기 자동 입력 · 지원 칸반 · 웹 푸시 알림 · "오늘 할 일" 전략 추천을 더한다. Claude 수집은 계속 유지하고 앱과 동기화한다.

## 기술 스택 (결정)
| 영역 | 선택 | 이유 |
|---|---|---|
| 프레임워크 | Next.js (App Router) + TypeScript + Tailwind + shadcn/ui | Vercel 배포가 가장 쉬움, PWA 가능 |
| DB | **Neon Postgres** (Vercel Marketplace 무료) + Drizzle ORM | Supabase 무료 한도 소진. Firebase는 예약 작업에 유료(Blaze) 필요 → Neon이 깔끔 |
| 인증 | 혼자 쓰는 앱 → 비밀번호 1개(env) + 서명 쿠키 미들웨어 | 계정 시스템 불필요 |
| AI | Anthropic SDK — 공고 추출은 `claude-haiku-5-5`, 오늘 계획은 `claude-sonnet-5-5` | 구현 시 `claude-api` 스킬로 모델·파라미터 확인 |
| 알림 | Web Push (`web-push` + VAPID) + Service Worker | iOS는 16.4+에서 "홈 화면에 추가" 후 동작 |
| 예약 실행 | Vercel Cron(하루 1회 아침 브리핑) + 필요 시 GitHub Actions cron(마감 몇 시간 전 알림) | Hobby 플랜 cron은 하루 1회 제한 |
| 칸반 | dnd-kit | |

## 데이터 모델 (기존 JSON 필드 1:1 대응)
- `postings`: id(기존 `기업명|공고명` 유지), company, title, job_category, company_type, company_type_basis, employment_type, location, open_date, deadline(+선택적 마감시각), fit(A/B/C), decision(''/예정/x/지원완료), status(진행중/마감), source, url, notes, **origin**(collected/manual), **effort**(예상 작업량: 자소서 문항 수·시간), **user_edited_fields**(동기화 시 덮어쓰지 않을 필드 목록), timestamps
- `applications`: posting_id, applied_at, stage(기존 `meta.전형단계` 14개 그대로), next_event_at, next_event_label, history(jsonb), notes
- `push_subscriptions`, `daily_plans`(date, 입력 스냅샷, 결과 json), `meta`(전형단계·전형칼럼·적합도 설명 등 기존 meta 보관)

## 기능 (MVP)
1. **공고 목록** — 진행중/마감, 적합도·기업형태·고용형태·직무 필터, 검색, 마감 D-day 정렬, "마감 임박" 섹션. 기존 대시보드 탭 구성(`_tools/dashboard_template.html`)을 참고해 이식.
2. **공고 직접 추가** — URL 또는 공고 본문 텍스트(또는 스크린샷 이미지) 붙여넣기 → 서버가 URL이면 페이지 텍스트 수집 → Claude가 기업명·공고명·직무·접수기간·고용형태·근무지·자소서 문항 등 구조화 추출 → 확인 폼에서 수정 후 저장. 자소설닷컴 등 JS 렌더링/차단 사이트는 URL 수집이 실패할 수 있어 "본문 붙여넣기"를 기본 대안으로 둔다. 적합도는 meta의 A/B/C 기준을 프롬프트에 넣어 제안만 하고 사용자가 확정.
3. **지원 현황 칸반** — 열: 서류 → 인적성 → 1차면접 → 2차면접 → 최종 / 탈락 (기존 `meta.전형칼럼` 매핑 사용). 드래그로 단계 이동, 카드에 다음 일정 표시·편집, 이력 자동 기록.
4. **알림** — 매일 아침(예: 08:00 KST) 브리핑 푸시: 오늘 마감·D-3 이내 "예정" 공고, 오늘/내일 전형 일정. 마감 당일 몇 시간 전 추가 알림(GitHub Actions cron).
5. **오늘 할 일 추천** — 하이브리드:
   - 규칙 기반 점수(API 없어도 동작): 마감 임박도 × 적합도 가중 × 남은 작업량, 다가오는 면접/인적성 준비 시간 확보.
   - Claude가 점수 상위 항목 + 사용자가 입력한 "오늘 쓸 수 있는 시간"을 받아 시간 블록 계획 생성: "오늘 A사 자소서 1~2번 완성, B사는 기존 자소서 재활용해 마무리, C사 면접 대비 30분" + 왜 이 순서인지 + 이번 주 전체 지원이 품질을 유지하며 가능한지 경고(과부하면 포기 후보 제시).
   - 결과는 `daily_plans`에 저장, 체크박스로 진행 체크.

## Claude 수집과의 동기화
- **1단계(MVP)**: `scripts/sync.ts` — `채용공고_데이터.json`을 읽어 id 기준 upsert. 수집 필드(마감·상태·링크 등)는 갱신하되, 앱에서 사용자가 수정한 필드(`user_edited_fields`: 지원여부·적합도·메모 등)는 보존. 최초 1회 전체 import에도 사용. `지원현황[]`도 같은 방식.
- **2단계**: 앱에 `/api/ingest`(토큰 인증) 추가 → Claude 수집 작업과 `job-tracker-update` 스킬이 JSON 대신 이 API를 호출하도록 수정. 이후 DB가 단일 원본이 되고 JSON은 백업 export(`/api/export`)로만 생성.

## 단계별 진행
1. 프로젝트 셋업(Next.js, Tailwind, shadcn, Drizzle, Neon 연결, 비밀번호 미들웨어) + 스키마 + `sync.ts`로 기존 데이터 import → Vercel 배포
2. 공고 목록·필터·마감 임박 화면 (모바일 우선 레이아웃)
3. 지원 현황 칸반 + 일정 편집
4. 공고 붙여넣기 자동 추출 (Claude)
5. PWA(manifest·service worker) + 웹 푸시 + 아침 브리핑 cron
6. 오늘 할 일 추천
7. (이후) `/api/ingest` 전환, 자소서 문항·마스터 이력서 연결, `기업 분석/` 노트 연결

## 주요 파일 (작업 폴더: `/Users/kang-yeongmo/orca/projects/get_a_job`)
- `src/db/schema.ts`, `drizzle.config.ts`
- `scripts/sync.ts` (원본: `/Users/kang-yeongmo/2026 취업하기/채용공고_데이터.json`, 읽기 전용으로만 사용)
- `src/app/(app)/postings`, `src/app/(app)/board`, `src/app/(app)/today`, `src/app/(app)/postings/new`
- `src/app/api/extract`, `src/app/api/plan`, `src/app/api/cron/briefing`, `src/app/api/push/subscribe`
- `src/lib/priority.ts`(규칙 기반 점수), `src/lib/claude.ts`
- `public/manifest.webmanifest`, `public/sw.js`, `vercel.json`(cron)
- 비밀값: `DATABASE_URL`, `APP_PASSWORD`, `ANTHROPIC_API_KEY`, `VAPID_*`, `CRON_SECRET` (`.env.local`, git 제외)

## 검증
- `sync.ts` 실행 후 DB 건수 = 공고 595 / 지원현황 25, 진행중 71건 일치 확인; 두 번 실행해도 중복 없음; 앱에서 지원여부 바꾼 뒤 재동기화해도 유지되는지 확인
- 로컬 `npm run dev` → 브라우저로 목록·필터·칸반 드래그 동작 확인 (모바일 뷰포트 포함)
- 실제 공고 URL 2~3개(사람인·잡코리아·자소설) + 본문 붙여넣기로 추출 정확도 확인
- 배포 후 폰에서 홈 화면 추가 → 테스트 푸시 수신, cron 엔드포인트 수동 호출로 브리핑 확인
- 오늘 할 일: 마감 임박 "예정" 공고가 상위에 오는지, 가용 시간 입력에 따라 계획이 달라지는지 확인
- 기존 `2026 취업하기` 폴더 파일은 수정하지 않음 (읽기만)

---
## 변경 사항 (2026-10-24, 사용자 피드백 반영)
- **범위**: 이력서·자소서 작성 기능은 넣지 않는다. 핵심은 공고 일정 관리 + "어떻게 일정을 짜야 하는지" 추천.
- **일정 엔진** (`src/lib/schedule.ts`, 완료·테스트 5개 통과): 남은 작업 시간을 하루 가용 시간 안에서 마감 빠른 순으로 배분, 마감 1일 전 완료 목표, 면접·인적성 준비 시간 자동 확보, 시간 부족 시 위험 공고 + 포기 후보(적합도 낮은 순, A 제외).
- **구글 캘린더 연동** (Google Calendar API, OAuth):
  - 앱 전용 캘린더 "취업 일정"을 만들어 그 안에서만 생성·수정·삭제.
  - 표시: 전형별 접수 기간(기본은 서류 접수 기간, 전형이 진행되면 현재 단계 일정만) + 작업 블록(시간대 배치, 계획 바뀌면 자동 재배치).
  - 내 기존 일정은 FreeBusy로 읽어 날짜별 가용 시간에서 뺀다.
- **미결정 공고**: 캘린더에 넣지 않고 푸시 알림으로 "지원할까요?" → 예정/관심 없음 결정.
- **받은편지함 + 학습 필터**: 수집된 새 공고는 받은편지함으로. "관심 없음" 시 이유(직무·지역·고용형태·기업규모 등) 기록 → 비슷한 공고 자동 숨김 + Claude 수집 조건 문서로 내보내기.
- **디자인**: 프론트 화면 작업 전에 사용자와 디자인 논의 후 진행.
