# 선택 기능: 구글 캘린더 (15분)

켜면 앱이 내 캘린더의 **바쁜 시간만** 읽어(제목·내용은 못 봄) 지원서 작업을 빈 시간에 배치하고, 앱이 만든 **"취업 일정" 캘린더 안에서만** 접수 기간·전형 일정·작업 시간을 만들고 고칩니다.

내 구글 클라우드 프로젝트를 만들어 나만 씁니다. 그래서 구글 심사가 필요 없습니다.

## 1. 프로젝트와 API
1. https://console.cloud.google.com → 새 프로젝트 (예: `get-a-job`)
2. **API 및 서비스 → 라이브러리** → "Google Calendar API" → **사용**

## 2. OAuth 동의 화면
1. **API 및 서비스 → OAuth 동의 화면**(Google Auth Platform) → 시작하기
2. 앱 이름 `취업 일정`, 지원 이메일·연락처: 내 이메일, 대상: **외부(External)**
3. **데이터 액세스** → 범위 추가:
   - `https://www.googleapis.com/auth/calendar.freebusy`
   - `https://www.googleapis.com/auth/calendar.app.created`
4. **대상** → **앱 게시** → "프로덕션 단계"로 바꿉니다.
   - "테스트" 상태로 두면 7일마다 연결이 끊깁니다.
   - 심사를 받지 않았으므로 연결할 때 "Google에서 확인하지 않은 앱" 경고가 나옵니다. 내가 만든 앱이므로 **고급 → 취업 일정(으)로 이동**을 누르면 됩니다.
5. 개인정보처리방침 주소가 필요하면 `https://<내 배포 주소>/privacy` (`.env`의 `CONTACT_EMAIL`이 표시됩니다)

## 3. OAuth 클라이언트
1. **클라이언트 → 만들기** → 유형 **웹 애플리케이션**
2. 승인된 리디렉션 URI:
   - `http://localhost:3000/api/google/callback`
   - `https://<내 배포 주소>/api/google/callback`
3. 클라이언트 ID와 보안 비밀번호를 `.env.local`과 Vercel 환경변수의 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`에 넣고 Redeploy.

## 4. 연결
앱에 로그인한 브라우저에서 `/api/google/connect`로 이동 → 계정 선택 → 허용. 구글 캘린더에 "취업 일정" 캘린더가 생깁니다.

개인 일정이 기본 캘린더가 아닌 다른 캘린더에 있으면, 그 캘린더의 ID(캘린더 설정 → 캘린더 통합)를 `GOOGLE_BUSY_CALENDARS`에 쉼표로 넣습니다.
