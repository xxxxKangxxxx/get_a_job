# justdo 연동

get_a_job의 **서류 접수 기간**을 justdo(https://www.justdo.co.kr) 할 일로 보낸다. 화면 없이 서버끼리 주고받는다.

## 무엇을 보내나
- 지원 예정(`예정`) 공고 → 접수 시작일~마감일 기간 할 일 (열림)
- 지원완료 공고 → 같은 할 일을 완료로 표시 (justdo에서 다시 열지 않음)
- 미정·보류·관심 없음, 수시(마감 없음), 마감이 지난 공고는 보내지 않는다
- 제목 `회사 서류 접수 (~마감시각)`, 메모 `공고명 / 적합도 / 링크`, justdo 카테고리 `취업`(없으면 만듦)
- 더 이상 보내지 않는 할 일은 justdo가 지운다. 단 완료했거나 마감이 지난 할 일은 기록으로 남긴다.

justdo에서 제목·날짜를 고치면 다음 동기화 때 get_a_job 값으로 돌아간다. 지워도 공고가 예정이면 다시 생긴다.

## 언제 보내나
- 매일 08:00 cron (`/api/cron/daily`)
- 받은함 결정, 결정 되돌리기, 공고 수정·추가, 지원서 제출 직후 (`after`로 응답 뒤에)
- 수동: 로그인한 상태에서 `POST /api/justdo/sync`

## 설정
1. justdo에서 연동 토큰 발급 (justdo 저장소 `docs/integrations.md`):
   `node --env-file=.env.local scripts/issue-integration-token.mjs --email <justdo 계정 이메일> --source get_a_job --label "취업 일정"`
2. Vercel 환경변수 `JUSTDO_API_URL=https://www.justdo.co.kr`, `JUSTDO_API_TOKEN=jd_int_...` 추가 후 재배포.
둘 중 하나라도 없으면 동기화는 건너뛴다.

코드: `src/lib/justdo/` (items.ts 계산, sync.ts 전송).
