# data/ — 내 데이터 (git에 올라가지 않음)

- `postings.json` — 공고·지원현황 원본. 공고 수집 스킬이 여기에 쌓고 `pnpm sync`로 DB에 넣는다.
- `profile.md` — 내 조건(희망 직무·지역·적합도 기준).

처음에는 `pnpm init-data`가 `templates/`에서 두 파일을 만든다.
다른 곳에 두려면 `.env.local`에 `POSTINGS_JSON`, `PROFILE_MD` 경로를 적는다.
