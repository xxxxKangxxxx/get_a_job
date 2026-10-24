# 인프라 동작 확인 기록

## 1. Neon
(사용자 DB 생성 대기 중)

## 2. 인증 (APP_PASSWORD 잠금) — 2026-10-24 로컬 확인
테스트용 값(`APP_PASSWORD=test-pw`, `CRON_SECRET=test-cron`)으로 `next dev` 후 curl:

| 요청 | 결과 |
|---|---|
| 로그인 없이 `/` | 307 → `/login` |
| 로그인 없이 `/schedule?x=1` | 307 → `/login?next=%2Fschedule%3Fx%3D1` |
| 로그인 없이 `/api/google/status` | 401 `{"error":"unauthorized"}` |
| 틀린 비밀번호 POST `/api/auth/login` | 1초 지연 후 303 → `/login?error=1&next=%2Fschedule`, 화면에 "비밀번호가 맞지 않아요" |
| 맞는 비밀번호 + `next=//evil.com` | 303 → `/` (외부 주소로 안 보냄), `gaj_session` 쿠키 발급 |
| 쿠키로 `/` | 200 |
| 위조 쿠키 | 307 → `/login` |
| `/api/cron/*` 헤더 없음 / 로그인 쿠키만 | 401 / 401 |
| `/api/cron/*` `Authorization: Bearer <CRON_SECRET>` | 통과 (라우트 생기기 전이라 404) |
