# 세션 분담

이 프로젝트는 세 세션이 나눠서 진행한다. 세션끼리는 대화를 공유하지 않으므로 **이 폴더의 문서가 유일한 연결 고리**다.

| 세션 | 담당 | 시작 문서 | 결과를 남기는 곳 |
|---|---|---|---|
| 총괄 | 계획, 일정 엔진, 데이터 동기화, 기능 로직(서버 액션·API), 화면 통합 | `docs/PLAN.md` | `docs/PLAN.md`, `docs/handoff/STATUS.md` |
| 디자인 | 레퍼런스 조사 → 방향 제안 → 시안 → 디자인 토큰·컴포넌트 규칙 | `docs/handoff/design.md` | `docs/design/` |
| 인프라 | Neon, Vercel 배포, 구글 캘린더 OAuth, 웹 푸시, cron | `docs/handoff/infra.md` | `docs/infra/`, 관련 코드 |

## 규칙
- 작업을 시작할 때와 끝낼 때 `docs/handoff/STATUS.md`를 읽고 자기 칸을 갱신한다 (무엇을 했는지, 다른 세션이 알아야 할 것, 막힌 것).
- 자기 담당 파일만 고친다. 남의 영역을 바꿔야 하면 STATUS.md의 "요청" 칸에 적는다.
  - 디자인: `docs/design/`, 시안 아티팩트. 코드는 고치지 않는다(토큰·컴포넌트 규칙 문서까지만).
  - 인프라: `src/lib/google/`, `src/lib/push/`, `src/app/api/cron/`, `src/app/api/google/`, `vercel.json`, `.env.example`, `docs/infra/`. `src/db/schema.ts`를 바꿔야 하면 요청으로 남기거나 새 테이블만 추가하고 STATUS에 적는다.
  - 총괄: 그 밖의 전부(`src/db`, `src/lib/schedule.ts`, `scripts/`, `src/app` 화면).
- 비밀값(.env.local)은 커밋하지 않는다. 필요한 변수 이름은 `.env.example`에 적는다.
- 사용자 원본 폴더 `/Users/kang-yeongmo/2026 취업하기/`는 읽기만 한다.
- 사용자와의 대화는 한국어로 한다.
