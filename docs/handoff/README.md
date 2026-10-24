# 세션 분담 (Orca 오케스트레이션)

총괄 세션이 Orca로 작업자 3개를 띄워 지휘한다. 작업자는 각자 Orca worktree(별도 폴더·브랜치)에서 일한다.

| 역할 | 브랜치 | 시작 문서 | 고칠 수 있는 파일 |
|---|---|---|---|
| 기획·총괄 | `master` | `docs/PLAN.md` | `docs/`, `src/contracts/`, 브랜치 병합 |
| 백엔드 | `backend` | `docs/handoff/backend.md` | `src/db/`, `src/lib/` (google·push 제외), `src/server/`, `scripts/`, `drizzle/` |
| 프론트엔드(디자인) | `frontend` | `docs/handoff/frontend.md` | `docs/design/`, `src/app/` (api·login 제외), `src/components/`, `src/app/globals.css`, `public/` 아이콘·폰트 |
| 인프라 | `infra` | `docs/handoff/infra.md` | `src/proxy.ts`, `src/app/login/`, `src/app/api/`, `src/lib/google/`, `src/lib/push/`, `public/sw.js`, `vercel.json`, `.env.example`, `docs/infra/` |

## 공통 규칙
- 먼저 `docs/DECISIONS.md`(결정 기록)와 자기 시작 문서를 읽는다. 결정 기록과 다르게 하지 않는다.
- **화면 ↔ 서버 약속**: `src/contracts/types.ts`와 `src/server/queries.ts`·`actions.ts`의 함수 이름·인자·반환 모양. 프론트엔드는 이것만 import해서 쓰고, 백엔드는 이 모양을 지키며 구현한다. 바꿔야 하면 총괄에게 `ask`로 요청한다(직접 바꾸지 않는다).
- 자기 영역 밖 파일은 고치지 않는다. `package.json`에 패키지를 추가하는 것은 괜찮지만 완료 보고에 적는다.
- DB 스키마 변경은 백엔드만. 인프라가 테이블이 필요하면(예: 구글 토큰) 새 테이블 파일 `src/db/schema-infra.ts`를 만들고 보고에 적는다. 마이그레이션 파일 생성은 병합 후 총괄이 한다.
- 사용자 결정이 필요하면 직접 묻지 말고 총괄에게 `ask`로 질문한다. 총괄이 사용자에게 물어 답한다.
- 비밀값(.env.local)은 커밋하지 않는다. 사용자 원본 폴더 `/Users/kang-yeongmo/2026 취업하기/`는 읽기만 한다.
- 단계마다 자기 브랜치에 커밋한다(푸시 금지). 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- 사용자와 대화할 일이 생기면 한국어로 쉽게.
