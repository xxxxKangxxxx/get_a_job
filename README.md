# get_a_job — 취업 일정 관리

내 조건에 맞는 채용 공고를 Claude가 모아 오고, 앱에서 지원할지 고르면 접수 기간·전형 일정·준비 시간을 관리해 주는 **개인용** 웹앱입니다. 각자 자기 사본을 설치해서 혼자 씁니다(내 데이터는 내 DB에만 있습니다).

- **공고 수집**: Claude Code 스킬이 채용 사이트(자소설닷컴·사람인·링커리어·잡코리아 등)에서 내 조건(`data/profile.md`)에 맞는 공고를 찾아 적합도 A/B/C를 매겨 넣습니다.
- **새 공고 고르기**: 공고마다 지원 / 보류 / 관심 없음. 관심 없는 이유를 고르면 비슷한 공고를 앞으로 자동으로 숨깁니다.
- **지원 기록**: "OO 지원했어", "서류 붙었어, 면접 11/3 14시" 처럼 Claude에게 말하면 기록됩니다.
- **일정 계산**: 마감과 가용 시간을 보고 하루에 할 지원서 작업을 나눕니다(화면은 준비 중).
- **선택 기능**: [구글 캘린더](docs/setup/google.md) · [웹 푸시 알림](docs/setup/push.md) · [justdo 연동](docs/setup/justdo.md)

> 지금 화면은 "새 공고" 고르기 하나입니다. 일정·지원현황 화면은 만드는 중입니다.

## 준비물

- Node.js 20 이상, [pnpm](https://pnpm.io/installation)
- [Claude Code](https://docs.claude.com/claude-code) — 공고 수집과 지원 기록에 씁니다
- (배포할 때) [Neon](https://neon.tech)·[Vercel](https://vercel.com) 무료 계정

## 설치 (로컬, 5분)

```bash
git clone <이 저장소 주소> get_a_job && cd get_a_job
pnpm install
pnpm first-setup --email 내@이메일.com   # .env.local 생성(비밀번호·키 자동), data/ 폴더, 로컬 DB 준비
```

`first-setup`이 출력하는 **앱 비밀번호**를 기억해 두세요(`.env.local`의 `APP_PASSWORD`).

1. `data/profile.md`를 열어 **내 조건**(희망 직무, 적합도 A/B/C 기준, 지역, 고용 형태)을 고칩니다.
2. 이 폴더에서 Claude Code를 열고 **"새 공고 찾아줘"** 라고 말합니다. `collect-postings` 스킬이 공고를 찾아 넣습니다.
3. `pnpm dev` → http://localhost:3000 → 비밀번호로 들어가서 공고를 고릅니다.

이미 공고를 모아 둔 JSON(아래 형식)이 있으면 `.env.local`에 `POSTINGS_JSON=<경로>`를 적고 `pnpm sync` 하면 됩니다.

## 매일 쓰는 법

| 하고 싶은 것 | 방법 |
|---|---|
| 새 공고 받기 | Claude Code에서 "새 공고 찾아줘" (주 1~2회) |
| 지원할지 고르기 | 앱의 "새 공고" 화면 |
| 제출·결과·면접 일정 기록 | Claude Code에서 "OO 지원했어", "OO 서류 붙었어, 면접 11/3 14시" — 또는 `pnpm track …` |
| 폰에서 보기, 아침 알림 | [배포](docs/setup/deploy.md) 후 홈 화면에 추가 |

## 배포

[docs/setup/deploy.md](docs/setup/deploy.md) — Neon(DB) + Vercel. 배포할 때마다 DB 마이그레이션이 자동으로 돌고, 매일 08:00(한국 시간)에 동기화·알림 작업이 돕니다.

## 명령 모음

| 명령 | 하는 일 |
|---|---|
| `pnpm first-setup [--email …]` | 처음 한 번: `.env.local`·`data/`·DB 준비 |
| `pnpm dev` | 로컬 실행 (`DATABASE_URL`이 비면 로컬 DB `.pglite/`) |
| `pnpm postings:add <파일> [회차]` | 새 공고 배열을 `data/postings.json`에 합침 (검증, 중복 건너뜀) |
| `pnpm sync` | `data/postings.json` → DB (앱에서 고친 값은 덮어쓰지 않음) |
| `pnpm track <find\|plan\|apply\|step\|skip…> <키워드>` | 지원 계획·제출·전형 결과 기록 |
| `pnpm db:migrate` | DB 표 만들기·갱신 |
| `pnpm test` | 테스트 |

## 데이터

- `data/postings.json` — 공고 원본. `{ meta, 공고: [...], 지원현황: [...] }` 형식(빈 틀: `templates/postings.empty.json`, 칸 설명: `scripts/add-postings.ts` 맨 위).
- `data/profile.md` — 내 조건. 예시: `templates/profile.example.md`.
- 둘 다 git에 올라가지 않습니다. 앱에서 바꾼 결정·진행률은 DB에 있고, `sync`가 덮어쓰지 않습니다.

## 구조

Next.js 16 (App Router) · Drizzle ORM · Neon Postgres (로컬은 PGlite) · Vercel Cron · Web Push.

- `src/server/` — 조회(`queries.ts`)·변경(`actions.ts`)·일정 계산(`plan.ts`)
- `src/lib/google|push|justdo/` — 선택 기능
- `scripts/` — 설치·동기화·수집·기록 명령
- `.claude/skills/` — Claude Code 스킬 (`collect-postings`, `track-applications`)
