# 4단계: 구글 캘린더 연결 준비 (Google Cloud, 사용자가 직접 · 15분)

앱이 내 캘린더의 **바쁜 시간만** 읽고(제목·내용은 못 봄), 앱이 만든 **"취업 일정" 캘린더 안에서만** 일정을 만들고 고치도록 권한을 받습니다.

## 1. 프로젝트 만들기
1. https://console.cloud.google.com 접속 (캘린더를 쓰는 구글 계정으로 로그인)
2. 위쪽 프로젝트 선택 → **새 프로젝트** → 이름 `get-a-job` → 만들기

## 2. Calendar API 켜기
1. 왼쪽 메뉴 **API 및 서비스 → 라이브러리**
2. "Google Calendar API" 검색 → **사용**

## 3. OAuth 동의 화면 (Google Auth Platform)
1. **API 및 서비스 → OAuth 동의 화면** (또는 "Google Auth Platform") → **시작하기**
2. 앱 이름 `취업 일정`, 사용자 지원 이메일: 내 이메일 → 대상: **외부(External)** → 연락처 이메일 → 동의 → 만들기
3. **데이터 액세스(범위)** → 범위 추가 → 아래 두 개를 찾아 체크 (안 보이면 아래 "수동으로 범위 추가"에 붙여넣기)
   - `https://www.googleapis.com/auth/calendar.freebusy`
   - `https://www.googleapis.com/auth/calendar.app.created`
   - (`openid`, `.../auth/userinfo.email` 은 기본)
4. **대상(Audience)** → **앱 게시(Publish app)** → 확인 → 상태가 "프로덕션 단계"가 되어야 합니다.
   - 왜? "테스트" 상태로 두면 **7일마다 연결이 끊깁니다**(refresh token 7일 만료).
   - 혼자 쓰는 앱이라 구글 인증 심사는 받지 않습니다. 대신 연결할 때 **"Google에서 확인하지 않은 앱"** 경고가 나옵니다 → **고급 → 취업 일정(으)로 이동(안전하지 않음)** 을 누르면 됩니다. 내가 만든 앱이라 괜찮습니다.
   - 미인증 앱은 사용자 100명 제한이 있지만 혼자 쓰므로 상관없습니다.

## 4. OAuth 클라이언트 ID 만들기
1. **클라이언트(Clients)** (또는 사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID)
2. 애플리케이션 유형: **웹 애플리케이션**, 이름 `get-a-job web`
3. **승인된 리디렉션 URI** 두 개 추가
   - `http://localhost:3000/api/google/callback`
   - `https://<내 Vercel 주소>/api/google/callback` (3단계 배포 주소, 아직 없으면 나중에 추가)
4. 만들기 → 나오는 **클라이언트 ID**와 **클라이언트 보안 비밀번호**를 복사

## 5. 값 넣기 (채팅에 붙여넣지 마세요)
- `/Users/kang-yeongmo/orca/workspaces/get_a_job/infra/.env.local` 에
  ```
  GOOGLE_CLIENT_ID=…
  GOOGLE_CLIENT_SECRET=…
  ```
- Vercel 환경변수에도 같은 두 개 → Redeploy

## 6. 연결하기
- 앱에 로그인한 브라우저에서 `/api/google/connect` 로 이동 (나중에 설정 화면 버튼이 생깁니다)
- 구글 계정 선택 → 경고 화면에서 고급 → 이동 → 권한 허용
- 끝나면 구글 캘린더에 **"취업 일정"** 캘린더가 새로 생깁니다.

## 7. 개인 일정이 다른 캘린더에 있다면 (바쁜 시간이 0건일 때)
앱은 기본으로 **기본 캘린더(내 이메일 이름의 캘린더)** 의 바쁜 시간만 읽습니다. 약속을 "개인", "회사" 같은 다른 캘린더에 넣는다면:
1. 구글 캘린더(PC) → 왼쪽 "내 캘린더"에서 그 캘린더 옆 ⋮ → **설정 및 공유** → 아래쪽 **캘린더 통합 → 캘린더 ID** 복사 (예: `abcd…@group.calendar.google.com`)
2. Vercel 환경변수 `GOOGLE_BUSY_CALENDARS` 에 넣기 (여러 개면 쉼표로) → Redeploy
3. 다음 동기화부터 그 캘린더의 바쁜 시간도 빠집니다. id가 틀리면 연결 상태의 오류에 "바쁜 시간을 읽지 못한 캘린더: …"가 표시됩니다.

참고: 종일 일정이나 "한가함(free)"으로 표시된 일정은 구글이 바쁜 시간으로 치지 않습니다.
