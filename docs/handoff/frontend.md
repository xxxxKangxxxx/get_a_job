# 프론트엔드(디자인) 작업자 인수인계

먼저 `docs/handoff/README.md`, `docs/DECISIONS.md`, `AGENTS.md`(Next.js 16은 바뀐 점이 많다 — `node_modules/next/dist/docs/` 확인)를 읽는다.

## 앱 한 줄 요약
혼자 쓰는 취업 준비 PWA. 핵심은 **"내 공고 일정 관리 + 오늘 무엇을 어디까지 해야 하는지 알려 주기"**. 이력서·자소서 작성 기능은 없다.

## 사용자 피드백 (가장 중요)
- 1차 시안 https://claude.ai/artifact/1nJ9bFjcMJpooHRq2QjeFK 은 **"너무 별로다. 훨씬 트렌디하고 고급스러워야 한다."**
- 1차 시안은 토스풍(연회색 #F2F4F6 배경, 흰 둥근 카드, 파랑 #3182F6 하나, Noto Sans KR)이었고 흔하고 밋밋했다. 시각 언어는 처음부터 다시 잡는다. 정보 구조는 참고만.
- 유지할 방향(D14): 홈 = 오늘 할 일 중심, 분위기 = 친근한 모바일 앱형, 받은편지함 = 카드 한 장씩 넘기기.

## 1단계 — 조사와 방향 제안 (코드 작성 없음)
1. 2025~2026년 트렌디하고 고급스러운 모바일 생산성·일정 앱을 웹에서 조사한다 (예: Things 3, Structured, Amie, Sunsama, Linear 모바일, Notion Calendar, Arc, Raycast, Craft, 최신 Apple 기본 앱, Mobbin·Dribbble의 생산성·핀테크 앱). 무엇이 "고급스럽게" 보이게 하는지 구체적으로 정리한다: 타이포 위계, 여백, 색 절제, 깊이·질감·블러, 모션, 데이터 시각화, 다크 모드. → `docs/design/research.md`
2. 서로 확실히 다른 방향 2~3개를 만든다. 각 방향: 이름, 무드 한 줄, 핵심 규칙(색·글꼴·형태), **홈 화면 시안 1장**(Artifact 디자인 캔버스, 390×844, 실제 데이터 사용). 한글 글꼴은 실제로 쓸 수 있는 것(Pretendard 셀프호스팅, SUIT, Wanted Sans 등).
3. **총괄에게 `ask`로 시안 링크와 방향 요약을 보내고 사용자의 선택을 기다린다.** (사용자에게 직접 묻지 않는다.)

## 2단계 — 시안 확정
4. 고른 방향으로 4개 화면 시안: ① 홈(오늘 할 일) ② 받은편지함 카드(관심 없음 이유 고르기 포함) ③ 일정(날짜별 작업 블록·개인 일정·시간 부족 경고와 해결책) ④ 지원 현황(전형 단계). 라이트·다크 둘 다.
5. 총괄에게 `ask`로 링크를 보내 사용자 승인을 받는다. 수정 요청이 오면 반영 후 다시 `ask`.
6. `docs/design/tokens.md`(색 라이트/다크, 글꼴, 크기 단계, 간격, 반경, 그림자, 모션 — Tailwind v4 `@theme` 변수로), `docs/design/components.md`(카드, 할 일 행, 진행 막대, 경고 배너, 하단 탭, 버튼, 적합도 배지 A/B/C, 빈 상태).

## 3단계 — 화면 구현 (사용자 승인 후에만)
7. `src/app/globals.css`에 토큰, 글꼴은 `public/fonts/` 셀프호스팅 + `next/font/local`.
8. 레이아웃: 하단 탭(오늘 / 일정 / 받은함 / 지원현황 / 공고) + 공고 추가 버튼. 모바일 우선, PC에서는 가운데 정렬 또는 2단.
9. 화면: `/`(오늘), `/schedule`, `/inbox`, `/board`, `/postings`, `/postings/[id]`, `/postings/new`, `/settings`(가용 시간·숨김 규칙·캘린더 연결 상태).
10. 데이터는 **반드시** `@/server/queries`(읽기)와 `@/server/actions`(쓰기)만 사용한다. 지금은 가짜 데이터가 나온다 — 백엔드가 나중에 실제로 바꾼다. 타입은 `@/contracts/types`. 필요한 데이터가 약속에 없으면 총괄에게 `ask`.
11. Next 16 `cacheComponents: true`: DB/요청 데이터를 읽는 컴포넌트는 `<Suspense>`로 감싼다(문서 `01-app/01-getting-started/08-caching.md`). 로딩 상태도 디자인한다.
12. 아이콘 lucide-react(설치됨). 터치 영역 44px 이상, 본문 대비 4.5:1, `prefers-reduced-motion` 존중.

## 경계
- `src/server/`, `src/db/`, `src/lib/schedule.ts`, `src/contracts/`는 고치지 않는다.
- 로그인 화면(`src/app/login/`)과 API(`src/app/api/`)는 인프라 담당 — 디자인 토큰만 맞춰 주면 된다.

## 완료 기준
`pnpm build` 통과, `pnpm dev`로 모든 화면이 가짜 데이터로 뜨는 것을 확인(가능하면 스크린샷), 모바일 폭(390px)에서 가로 스크롤 없음.
