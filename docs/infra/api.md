# 인프라 API·서버 함수 사용법 (프론트엔드·백엔드용)

## 인증
- 모든 페이지·API는 로그인 필요 (`src/proxy.ts`). 로그인 안 됐으면 페이지는 `/login?next=…`로, API는 401.
- 예외: `/login`, `/api/auth/*`, `/api/cron/*`(CRON_SECRET), 정적 파일, `/sw.js`, `/manifest.webmanifest`, `/icons/*`.
- 로그아웃: `<form method="post" action="/api/auth/logout"><button>로그아웃</button></form>`
- 로그인 화면 `src/app/login/page.tsx`는 최소한. 디자인은 이 파일을 고쳐도 된다(폼은 `POST /api/auth/login`, 필드 `password`, `next` 유지, 오류는 `?error=1`).

## 구글 캘린더
| 주소 | 하는 일 |
|---|---|
| `GET /api/google/connect` | 구글 동의 화면으로 이동 (설정 화면 "연결" 버튼은 `<a href="/api/google/connect">`) |
| `GET /api/google/callback` | 구글이 돌려보내는 곳. 끝나면 `/settings?google=connected|denied|bad_state|error` |
| `GET /api/google/status` | `{ connected, lastSyncAt, email, error }` |
| `POST /api/google/sync` | 지금 동기화. `{ ok, busyRows, created, updated, deleted, unchanged }` |
| `POST /api/google/disconnect` | "취업 일정" 캘린더 삭제 + 권한 취소. body `{ keepCalendar: true }`면 캘린더는 남김 |

- 서버 코드에서: `import { getCalendarStatus } from "@/lib/google/status"` → contracts의 `CalendarStatus`(+email, error). 백엔드는 `TodayView.calendar`/`ScheduleView.calendar`에 그대로 쓰면 된다.
- `import { syncCalendar } from "@/lib/google/sync"` → 일정을 바꾸는 액션 뒤에 불러도 된다(구글 미연결이면 throw하니 `getAccount()`로 먼저 확인하거나 catch).
- 동기화 순서: FreeBusy(오늘부터 30일, primary + `GOOGLE_BUSY_CALENDARS`) → `busy_blocks`에서 `source='google'` 행을 그 기간만 지우고 다시 넣음 → `getSchedule(30)`·`getSettings()`·`listPostings({decision:["예정"],status:"진행중"})`로 넣을 이벤트 계산 → 해시 비교로 바뀐 것만 추가·수정·삭제.
- `busy_blocks` 행: `date`(YYYY-MM-DD), `start_time`/`end_time`("HH:MM", 자정에서 끝나면 "24:00", 하루 전체면 둘 다 null), `title`("개인 일정" — FreeBusy는 제목을 안 줌), `source`("google").
- 캘린더에 쓰는 것 (D10):
  - 📮 접수 기간: "예정" + 진행중 + 마감 ≥ 오늘 → 접수 시작~마감 종일(투명=바쁨 아님). 지원완료가 되면 사라지고 전형 일정만 남는다. 미결정·보류·x는 안 넣는다.
  - 📌 전형 일정: `DayLoad.events` 중 done 아님, kind ≠ 마감. 시각 있으면 1시간, 없으면 종일.
  - ✍️/🧠 작업 블록: `DayLoad.blocks`를 `workWindow` 안에서 `DayLoad.busy`를 피해 15분 단위로 배치, 넘치면 시간대 끝 뒤에 이어 붙임.
  - 지난 날짜 이벤트는 지우지 않고 남긴다.

## 웹 푸시
브라우저(클라이언트 컴포넌트):
```ts
import { pushState, enablePush, disablePush, sendTestPush } from "@/lib/push/client";
// pushState(): "unsupported" | "needs-install"(iOS 홈 화면 추가 필요) | "denied" | "off" | "on"
// enablePush(): 버튼 클릭 핸들러 안에서 호출해야 함 → 권한 요청·서비스 워커 등록·구독 저장
```
서버:
```ts
import { sendToAll, type PushPayload } from "@/lib/push/server";
await sendToAll({ title, body, url: "/inbox", tag, postingId, actions: [{ action: "apply", title: "지원할래요" }, { action: "skip", title: "관심 없음" }] });
```
| 주소 | 하는 일 |
|---|---|
| `GET /api/push/key` | `{ publicKey }` |
| `POST /api/push/subscribe` / `DELETE` | 구독 저장 / 삭제 (`push_subscriptions`) |
| `POST /api/push/test` | 모든 기기에 테스트 알림 |
| `POST /api/push/decide` | 알림 버튼 → `decideInbox(postingId, "예정" \| "x")` |

- 서비스 워커 `public/sw.js` 아이콘: `/icons/icon-192.png`, `/icons/badge-72.png` — **프론트엔드가 `public/icons/`에 만들어 주세요** (manifest.webmanifest도 프론트엔드).

## cron
| 주소 | 하는 일 |
|---|---|
| `GET /api/cron/daily` | 캘린더 동기화 → 아침 브리핑 → 미결정 A급 알림 (vercel.json: 매일 23:00 UTC = 08:00 KST) |
| `GET /api/cron/briefing` | 아침 브리핑만 (`getToday()`) |
| `GET /api/cron/google-sync` | 캘린더 동기화만 |
| `GET /api/cron/decisions` | 미결정 A급(`getInbox()`의 `reason="needDecision"`) 최대 3건 "지원할까요?" |

모두 `Authorization: Bearer <CRON_SECRET>` 필요. Vercel Hobby는 하루 1회라 `daily` 하나만 등록했다.
캘린더를 더 자주 맞추려면 GitHub Actions(아래)를 쓴다 — `.github/`는 인프라 소유가 아니라 예시만 둔다. 저장소 Secrets에 `APP_URL`, `CRON_SECRET`.
```yaml
# .github/workflows/cron.yml
name: cron
on:
  schedule: [{ cron: "0 0-14/3 * * *" }]   # 09~23시 KST, 3시간마다
  workflow_dispatch: {}
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - run: curl -fsS -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" "${{ secrets.APP_URL }}/api/cron/google-sync"
```

## 새 테이블 (`src/db/schema-infra.ts`, 마이그레이션은 총괄이 병합 후 생성)
- `google_accounts`: 연결된 구글 계정 1행(id="me"), refresh/access token, 앱 캘린더 id, 마지막 동기화 시각·오류
- `google_event_links`: 앱 항목 key ↔ 구글 이벤트 id, 내용 해시, 날짜
- `drizzle.config.ts`의 `schema`를 `["./src/db/schema.ts", "./src/db/schema-infra.ts"]`로 바꿔야 마이그레이션에 포함된다.
