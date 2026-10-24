# 백엔드 작업 보고 (2026-10-24)

`docs/handoff/backend.md` 작업 순서 1~6 완료. `src/server/queries.ts`·`actions.ts`는 **함수 이름·인자·반환 모양 그대로** 실제 DB 구현으로 바뀌었고 `src/server/mock.ts`는 지웠다. `src/contracts/types.ts`는 건드리지 않았다. 패키지 추가 없음.

## 확인 결과
- `pnpm vitest run` → 4개 파일, 27개 테스트 통과 (일정 변환·경고·받은편지함 영향·숨김 규칙 + 메모리 PGlite로 actions/queries 실제 실행)
- `pnpm tsc --noEmit` 통과 — 단, 깨끗한 checkout에서는 **먼저 `pnpm next typegen`**을 해야 `layout.tsx`의 `LayoutProps` 타입이 생긴다 (기존부터 그랬음, `next dev`/`next build`도 만들어 줌)
- `pnpm eslint src/server src/db scripts` 깨끗
- 로컬 PGlite: `rm -rf .pglite && pnpm tsx scripts/migrate.ts && pnpm tsx scripts/sync.ts` → 공고 595 / 진행중 71 / 지원현황 25. 두 번째 sync는 새 공고 0, 새 일정 0 (중복 없음)

## 바뀐 것
| 파일 | 내용 |
|---|---|
| `src/db/schema.ts`, `drizzle/0001_inbox_rules_busy.sql` | postings에 `inbox_state`(new/seen)·`decided_at`·`inbox_prev`(되돌리기용)·`hidden_by_rule`. 새 표 `hide_rules`, `busy_blocks`. 이미 결정된 공고는 seen으로 바꾸는 UPDATE 포함 |
| `scripts/sync.ts` | 처음 들어온 공고 → 받은편지함(new), 숨김 규칙에 맞으면 자동 숨김(지원여부 '' 유지). 기존 공고의 받은편지함 상태는 건드리지 않음 |
| `src/server/plan.ts` | DB 값 → 일정 엔진 입력, 결과 → `TodayTask`/`DayLoad`/`Warning`/`InboxImpact` (순수 함수) |
| `src/server/data.ts` | queries·actions 공용 DB 읽기, 숨김 규칙 적용 `applyHideRules` |
| `src/server/settings.ts` | 설정 기본값(D5)·검증. 저장은 `meta` key `settings` |
| `src/server/hide-rules.ts` | 규칙 판정 (근무지는 포함, 나머지는 같은 값, other는 자동 숨김 안 함) |
| `src/server/queries.ts`, `actions.ts` | 실제 구현 |
| `scripts/sample-queries.ts` | 실제 DB로 queries 실행. `--demo`는 A 공고 6건 예정·면접 1건·숨김 규칙 1건을 넣고 실행 (복사본 DB에서: `PGLITE_DIR=<복사본> pnpm tsx scripts/sample-queries.ts --demo`) |

## 구현하며 정한 것 (총괄 확인 부탁)
1. **결정 필요(needDecision)** = 적합도 A + 미결정('' 또는 보류) + 마감 D-7 이내. 보류 공고는 이 조건일 때만 받은편지함에 다시 올라온다.
2. 받은편지함 카드 = 진행중 + 숨김 안 됨 + 마감 안 지남 + 미결정. `counts.new`는 그중 아직 안 본(new) 것.
3. 경고 해결책 **포기(drop)를 적용하면 decision = `x`**. 받은편지함 결정처럼 `undoDecision`으로 되돌릴 수 있다.
4. 시간 늘리기(addHours) 적용 = `settings.overrides[날짜] = 그날 기본 시간 + hours` (하루 상한 12시간까지만 제안).
5. 오늘 할 일: 체크한 항목은 `daily_plans`(오늘)에 그때 모습을 저장해 done으로 계속 보이고, 그 시간만큼 오늘 남은 시간을 줄이며 같은 일은 오늘 더 배분하지 않는다. 해제하면 진행률을 progressFrom으로 되돌린다. 준비(prep) 체크 시간은 남은 준비 시간에서 빠진다.
6. `createPosting`(직접 추가)은 decision '' + 받은편지함 new로 들어간다. `markSubmitted`는 지원현황을 공고 id와 같은 id로 만든다(JSON 동기화와 같은 규칙).
7. 연결된 공고가 없는 면접·인적성 준비는 적합도 A로 친다(포기 후보로 안 나오게).
8. 캘린더 일정은 그날 기본 시간에서 길이만큼 뺀다(시각 없는 종일 일정 = 하루 전체). 날짜별 예외(overrides)가 있으면 예외 값이 기본 시간이다.

## 다른 작업자에게
- **인프라**: 바쁜 시간은 `busy_blocks`(date, start "HH:MM"|null, end, title, source)에 넣으면 일정 계산에 바로 반영된다. `CalendarStatus`는 `meta` key `calendar_status`에 `{ connected, lastSyncAt }`을 써 주면 읽는다(없으면 연결 안 됨).
- **프론트엔드**: actions는 성공 시 `revalidatePath("/", "layout")`로 전체를 다시 그린다. `next.config.ts`가 `cacheComponents: true`라 queries(DB 읽기, 캐시 안 함)를 부르는 컴포넌트는 `<Suspense>` 안에 두어야 한다.
- 범위 밖으로 남긴 것: Claude API 공고 추출(`extractPosting`).

## 실제 DB 결과 샘플 (2026-10-24, migrate + sync 직후)
원본에 "예정" 공고가 0건이라 오늘 할 일·경고는 비어 있는 게 맞다.

### getToday()
```json
{
 "date": "2026-10-24", "baseHours": 6, "busyHours": 0, "availableHours": 6,
 "tasks": [], "warnings": [],
 "week": [
  { "date": "2026-10-24", "capacity": 6, "used": 0, "overloaded": false, "blocks": [], "deadlines": [], "events": [] },
  { "date": "2026-10-25", "capacity": 6, "used": 0, ... },
  { "date": "2026-10-26", "capacity": 3, "used": 0, ... }, "... 10/30까지 7일"
 ],
 "counts": { "inbox": 69, "needDecision": 7 },
 "calendar": { "connected": false, "lastSyncAt": null }
}
```

### getInbox() — 앞 3장
```json
{
 "counts": { "new": 62, "needDecision": 7, "autoHidden": 0 },
 "total": 69,
 "cards": [
  { "company": "현대그린푸드", "title": "2026 신입사원 채용", "fit": "A", "deadline": "2026-10-25", "dday": 1, "reason": "needDecision",
    "impact": { "estHours": 4, "fits": true, "days": ["2026-10-24"], "message": "오늘 끝내면 다른 공고와 겹치지 않아요" } },
  { "company": "삼진제약", "title": "2026년 하반기 신입/경력 채용", "fit": "A", "deadline": "2026-10-26", "dday": 2, "reason": "needDecision",
    "impact": { "estHours": 4, "fits": true, "days": ["2026-10-24"], "message": "오늘 끝내면 다른 공고와 겹치지 않아요" } },
  { "company": "애경케미칼", "title": "각 부문 신입/경력 채용 (10월)", "fit": "A", "deadline": "2026-10-26", "dday": 2, "reason": "needDecision",
    "impact": { "estHours": 4, "fits": true, "days": ["2026-10-24"], "message": "오늘 끝내면 다른 공고와 겹치지 않아요" } }
 ]
}
```

### getBoard()
```json
{
 "totals": { "applied": 25, "active": 2, "finalPass": 1 }, "stages": "14개 (meta.전형단계)",
 "columns": [
  { "key": "준비 중", "n": 0 },
  { "key": "서류", "n": 1, "cards": ["기아 · 서류 결과 대기"] },
  { "key": "인적성", "n": 1, "cards": ["SK하이닉스 · 서류 합격 · 인적성 대기"] },
  { "key": "1차면접", "n": 0 }, { "key": "2차면접", "n": 0 },
  { "key": "최종", "n": 1, "cards": ["서울시 미래청년일자리 · 최종 합격"] },
  { "key": "탈락", "n": 22, "cards": ["CJ올리브네트웍스 · 불합격", "코스맥스 · 불합격", "하나은행 · 불합격", "..."] }
 ]
}
```

## 데모 결과 (DB 복사본, `--demo`: A 공고 6건 예정 + 첫 공고 진행률 30%·예상 5시간, 기아 1차면접 10/28 14:00, 숨김 규칙 1건)

### getToday() — 할 일·경고
```json
"tasks": [
 { "company": "현대그린푸드", "label": "구매·물류", "hours": 3.5, "progressFrom": 30, "progressTo": 100, "dueDate": "2026-10-25", "dday": 1, "fit": "A" },
 { "company": "애경케미칼", "label": "구매·생산", "hours": 2.5, "progressFrom": 0, "progressTo": 63, "dueDate": "2026-10-26", "dday": 2, "fit": "A" }
],
"warnings": [
 { "id": "overload:2026-10-27", "title": "10/27(화) 마감 1건이 몰려 있어요",
   "message": "15.5시간이 필요한데 그 전까지 15시간만 쓸 수 있어요",
   "atRisk": [{ "company": "일동홀딩스", "label": "구매", "fit": "A" }],
   "fixes": [
    { "kind": "addHours", "label": "10/24(토) 0.5시간 더 쓰기", "detail": "1건 모두 끝나요 · 10/24(토) 6.5시간" },
    { "kind": "addHours", "label": "10/25(일) 0.5시간 더 쓰기", "detail": "1건 모두 끝나요 · 10/25(일) 6.5시간" } ] },
 { "id": "overload:2026-10-28", "title": "10/28(수) 마감 2건이 몰려 있어요",
   "message": "27.5시간이 필요한데 그 전까지 18시간만 쓸 수 있어요",
   "atRisk": [ { "company": "동국제약", "fit": "A" }, { "company": "무림그룹", "fit": "A" }, { "company": "기아", "label": "1차면접 준비", "fit": "A" } ],
   "fixes": [
    { "kind": "addHours", "label": "10/24(토) 6시간 더 쓰기", "detail": "1건은 여전히 늦어요 · 10/24(토) 12시간" },
    { "kind": "addHours", "label": "10/25(일) 6시간 더 쓰기", "detail": "1건은 여전히 늦어요 · 10/25(일) 12시간" } ] }
],
"week": [
 "10/24 6/6h: 현대그린푸드 3.5h ✓, 애경케미칼 2.5h",
 "10/25 6/6h: 애경케미칼 1.5h ✓, 삼진제약 4h ✓, 일동홀딩스 0.5h  (마감: 현대그린푸드)",
 "10/26 3/3h: 일동홀딩스 3h  (마감: 애경케미칼, 삼진제약)",
 "10/27 3/3h: 동국제약 3h  (마감: 일동홀딩스)",
 "10/28 0/3h  (마감: 동국제약, 무림그룹 · 일정: 기아 1차면접)"
]
```
모두 적합도 A라 포기 후보는 나오지 않고(D6) 시간 늘리기만 제안된다. C·B가 섞이면 C부터 포기 후보로 나오는 것은 `plan.test.ts`에서 확인.

### getInbox() — 데모 후 앞 2장
```json
{ "counts": { "new": 61, "needDecision": 1, "autoHidden": 0 }, "total": 62,
  "cards": [
   { "company": "성도이엔지", "fit": "A", "deadline": "2026-10-31", "reason": "needDecision",
     "impact": { "estHours": 4, "fits": true, "days": ["2026-10-28", "2026-10-29"], "message": "10/28~10/29에 나눠 쓰면 다른 공고와 겹치지 않아요" } },
   { "company": "LS메탈", "fit": "C", "deadline": "2026-10-25", "reason": "new",
     "impact": { "estHours": 4, "fits": false, "days": ["2026-10-24"], "message": "마감 전까지 4시간을 낼 수 없어요" } } ] }
```
