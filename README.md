# get-a-job · 취업 일정 관리

> 공고 찾기는 Claude에게, 지원할지 고르기는 앱에서, 일정은 알아서.

취업 준비를 하다 보면 공고는 여러 사이트에 흩어져 있고, 마감은 겹치고, 어디까지 썼는지 헷갈립니다.
**get-a-job**은 이 일을 덜어 주는 **개인용** 웹앱입니다.

1. **Claude가 공고를 모아 옵니다.** 내 조건(희망 직무·지역·고용 형태)을 적어 두면, 채용 사이트를 조사해 맞는 공고를 찾고 적합도 A/B/C를 매겨 넣어 줍니다.
2. **앱에서 지원할지 고릅니다.** 공고마다 [지원] [보류] [관심 없음]. 관심 없는 이유를 고르면 비슷한 공고는 다음부터 알아서 숨겨집니다.
3. **말로 기록합니다.** "OO 지원했어", "서류 붙었어, 면접 11월 3일 2시야" 라고 Claude에게 말하면 지원 현황과 일정이 기록됩니다.
4. **(선택) 일정과 알림.** 구글 캘린더에 접수 기간·면접을 넣고, 매일 아침 오늘 할 일을 알림으로 받고, [justdo](https://www.justdo.co.kr) 할 일로도 보낼 수 있습니다.

**각자 자기 사본을 설치해서 혼자 쓰는 방식**입니다. 내 공고·지원 기록은 내 컴퓨터나 내 DB에만 저장되고, 다른 사람과 공유되지 않습니다.

> 🚧 지금 있는 화면은 "새 공고" 고르기입니다. 일정·지원 현황 화면은 만들고 있어요.

---

## 시작하기 전에 필요한 것

| 필요한 것 | 왜 | 설치 |
|---|---|---|
| **Node.js** 20 이상 | 앱을 돌립니다 | https://nodejs.org (LTS 버전) |
| **pnpm** | 패키지 설치 도구 | 터미널에서 `npm install -g pnpm` |
| **Claude Code** | 공고 수집과 지원 기록 | https://docs.claude.com/claude-code |
| git | 저장소 받기 | 맥은 보통 이미 있어요 |

처음에는 **내 컴퓨터에서만** 써 봐도 됩니다. 계정 만들 것도, 돈 드는 것도 없습니다. 폰에서 보거나 아침 알림을 받고 싶어지면 그때 [배포](#4-폰에서도-쓰고-싶다면-배포)하면 됩니다(무료 플랜으로 충분).

---

## 1. 설치하기 (5분)

터미널을 열고 차례로 붙여넣으세요.

```bash
git clone https://github.com/xxxxKangxxxx/get-a-job.git
cd get-a-job
pnpm install
pnpm first-setup --email 내이메일@example.com
```

`first-setup`이 해 주는 일:
- 설정 파일 `.env.local`을 만들고 **앱 비밀번호**와 필요한 키를 자동으로 채웁니다
- 내 데이터를 둘 `data/` 폴더를 만듭니다
- 내 컴퓨터 안에 작은 DB를 준비합니다

마지막에 나오는 **앱 비밀번호**를 메모해 두세요. 잊어버려도 `.env.local` 파일의 `APP_PASSWORD=` 줄에서 다시 볼 수 있고, 원하는 값으로 바꿔도 됩니다.

## 2. 내 조건 적기 (5분)

`data/profile.md`를 열어 예시를 **내 상황으로** 고칩니다. Claude가 이 파일을 읽고 공고를 고르니, 구체적일수록 결과가 좋아집니다.

```markdown
- **A (꼭 볼 공고)**: 구매, SCM·물류, 생산관리
- **B (인접 직무)**: 품질, 생산기술
- **C (참고용)**: 대기업·중견기업 전 직무 공채
- 근무지: 서울·경기 우선
```

## 3. 공고 모으고 고르기

```bash
claude            # 이 폴더에서 Claude Code 열기
```

Claude에게 이렇게 말하세요:

> **새 공고 찾아줘**

Claude가 자소설닷컴·사람인·링커리어·잡코리아 등을 조사해서 조건에 맞는 공고를 넣어 줍니다(몇 분 걸려요). 끝나면 앱을 엽니다:

```bash
pnpm dev
```

브라우저에서 http://localhost:3000 → 비밀번호 입력 → **새 공고** 화면에서 하나씩 고르면 됩니다.

- **지원**: "지원 예정" 탭으로 옮겨집니다. 제출했으면 [제출 완료]를 누릅니다.
- **보류**: 일단 넘깁니다. 적합도 A인 공고는 마감이 다가오면 다시 올라옵니다.
- **관심 없음**: "이 직무 / 이 지역 / 이 회사…" 중 이유를 고르면 비슷한 공고를 앞으로 자동으로 숨깁니다.
- 잘못 눌렀으면 아래에 잠깐 뜨는 **되돌리기**를 누르세요.

### 평소에는

| 하고 싶은 것 | 이렇게 |
|---|---|
| 새 공고 받기 (주 1~2회) | Claude에게 "새 공고 찾아줘" |
| 지원할지 고르기 | 앱의 새 공고 화면 |
| 지원했다고 기록 | Claude에게 "OO 지원했어" |
| 결과·다음 일정 기록 | "OO 서류 붙었어, 1차 면접 11/3 14시" / "OO 떨어졌어" |
| 안 쓰기로 함 | "OO은 안 낼래" |

## 4. 폰에서도 쓰고 싶다면 (배포)

[docs/setup/deploy.md](docs/setup/deploy.md)를 따라 하면 됩니다. 요약하면:

1. [Neon](https://neon.tech)에서 무료 DB를 만들고 주소를 `.env.local`의 `DATABASE_URL`에 넣기
2. 이 저장소를 **Fork**해서 내 GitHub에 두기
3. [Vercel](https://vercel.com)에서 Fork한 저장소를 Import하고, `.env.local`의 값을 환경변수로 옮기기
4. 배포 주소를 폰 브라우저로 열고 **홈 화면에 추가**

배포하면 매일 아침 8시(한국 시간)에 캘린더 동기화와 알림이 자동으로 돕니다.

## 5. 선택 기능

필요한 것만 켜세요. 설정하지 않은 기능은 그냥 건너뜁니다.

| 기능 | 하는 일 | 안내 |
|---|---|---|
| 구글 캘린더 | 내 일정의 빈 시간을 보고 준비 시간을 배치, "취업 일정" 캘린더에 접수 기간·면접 표시 | [google.md](docs/setup/google.md) |
| 웹 푸시 알림 | 아침 브리핑, 마감 임박 공고 알림 | [push.md](docs/setup/push.md) |
| justdo 연동 | 지원하기로 한 공고의 접수 기간을 justdo 할 일로. 토큰을 넣은 뒤 `pnpm justdo`로 연결 확인 | [justdo.md](docs/setup/justdo.md) |

---

## 자주 묻는 것

**내 데이터는 어디에 저장되나요?**
공고 원본은 `data/postings.json`, 조건은 `data/profile.md`, 앱에서 고른 결정과 기록은 DB(로컬은 `.pglite/` 폴더, 배포하면 내 Neon)에 있습니다. `data/`와 `.env.local`은 git에 올라가지 않아서 실수로 공개될 일이 없습니다.

**이미 모아 둔 공고 파일이 있어요.**
같은 형식(`{ meta, 공고: [...], 지원현황: [...] }`)이면 `.env.local`에 `POSTINGS_JSON=<파일 경로>`를 적고 `pnpm sync` 하면 됩니다. 빈 틀은 `templates/postings.empty.json`, 칸 설명은 `scripts/add-postings.ts` 맨 위에 있어요.

**Claude가 공고를 잘못 넣었어요.**
앱에서 [관심 없음]으로 넘기면 됩니다. 원본을 고치고 싶으면 `data/postings.json`을 직접 고친 뒤 `pnpm sync`. 앱에서 바꾼 값(결정, 진행률 등)은 sync가 덮어쓰지 않습니다.

**비밀번호를 바꾸고 싶어요.**
`.env.local`의 `APP_PASSWORD`를 고치고 `pnpm dev`를 다시 시작하세요. 배포했다면 Vercel 환경변수도 바꾸고 Redeploy.

**새 버전으로 업데이트하려면?**
Fork한 저장소에서 GitHub의 **Sync fork** → 내 컴퓨터에서 `git pull` 후 `pnpm install && pnpm db:migrate`. 배포한 경우 Vercel이 다시 배포하면서 DB도 자동으로 맞춥니다.

**justdo 토큰을 넣었는데 아무것도 안 생겨요.**
justdo에는 **[지원]으로 고른, 마감이 남은 공고**만 들어갑니다. `pnpm dev`를 다시 켜고 `pnpm justdo`를 실행해 연결을 확인한 뒤, 앱에서 공고 하나를 [지원]으로 골라 보세요. 자세한 건 [justdo.md](docs/setup/justdo.md#안-될-때).

**`pnpm dev`에서 오류가 나요.**
`pnpm install`을 다시 하고, `.env.local`이 있는지 확인하세요(없으면 `pnpm first-setup`). 그래도 안 되면 오류 메시지와 함께 이슈를 남겨 주세요.

---

## 명령 모음

| 명령 | 하는 일 |
|---|---|
| `pnpm first-setup [--email …]` | 처음 한 번: 설정 파일·`data/`·DB 준비 |
| `pnpm dev` | 앱 실행 (http://localhost:3000) |
| `pnpm postings:add <파일> [회차]` | 새 공고 배열을 `data/postings.json`에 합침 (검증, 중복은 건너뜀) |
| `pnpm sync` | `data/postings.json` → DB |
| `pnpm track <find\|plan\|apply\|step\|skip…> <키워드>` | 지원 계획·제출·전형 결과 기록 (Claude가 대신 실행) |
| `pnpm justdo` | justdo 연결 확인, 지금 바로 보내기 |
| `pnpm db:migrate` | DB 표 만들기·갱신 |
| `pnpm test` | 테스트 |

## 만든 방식

Next.js 16 (App Router) · Drizzle ORM · Postgres(Neon, 로컬은 PGlite) · Vercel Cron · Web Push

- `src/server/` — 조회(`queries.ts`), 변경(`actions.ts`), 일정 계산(`plan.ts`)
- `src/lib/google`, `push`, `justdo` — 선택 기능
- `scripts/` — 설치·동기화·수집·기록 명령
- `.claude/skills/` — Claude Code 스킬 (`collect-postings` 공고 수집, `track-applications` 지원 기록)
- API 설명: [docs/api.md](docs/api.md)

## 라이선스

[MIT](LICENSE) — 자유롭게 쓰고, 고치고, 나눠도 됩니다.
