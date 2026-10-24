# 1단계: Neon 데이터베이스 만들기 (사용자가 직접)

앱의 데이터(공고·지원현황·일정)를 저장할 온라인 DB를 만듭니다. 무료이고 5분 정도 걸립니다.

1. https://neon.tech 에 들어가 **Sign up** → GitHub 또는 구글 계정으로 가입합니다.
2. 새 프로젝트 만들기
   - Project name: `get-a-job`
   - Postgres version: 기본값 그대로
   - Region: **AWS Asia Pacific (Singapore)** 또는 Tokyo (한국에서 가까운 곳)
3. 프로젝트가 만들어지면 대시보드의 **Connect** 버튼을 누릅니다.
   - "Pooled connection"을 켠 상태로 연결 문자열을 복사합니다.
   - 모양: `postgresql://사용자:비밀번호@ep-xxxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`
4. 이 폴더에 `.env.local` 파일을 만들고(이미 있으면 그 안에) 한 줄을 넣습니다.
   - 폴더: `/Users/kang-yeongmo/orca/workspaces/get_a_job/infra/`
   ```
   DATABASE_URL=복사한_연결_문자열
   ```
5. 저장했으면 "넣었어요"라고만 알려 주세요. **연결 문자열(비밀번호 포함)은 채팅에 붙여넣지 마세요.**

그다음은 인프라 작업자가 표 만들기(migrate)와 기존 데이터 옮기기(sync)를 실행하고 건수를 확인합니다.
