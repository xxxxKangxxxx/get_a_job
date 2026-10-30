# 선택 기능: justdo 연동

[justdo](https://www.justdo.co.kr)를 쓰면, 지원하기로 한 공고의 **서류 접수 기간**이 justdo "취업" 카테고리에 할 일로 자동으로 들어갑니다.

- 지원 예정 → 접수 시작일~마감일 할 일 / 제출 완료 → 그 할 일이 완료로 바뀜
- 지원을 취소하면 justdo에서도 빠집니다(완료했거나 마감이 지난 할 일은 남음)
- 보내는 때: 앱에서 결정을 바꿀 때마다, 매일 08:00, `pnpm track` 실행 뒤

## 켜기
1. justdo 웹 → **설정 → 외부 연동** → 서비스 "취업 일정 (get_a_job)" → **토큰 만들기** → 복사 (한 번만 보입니다)
2. `.env.local`과 Vercel 환경변수에:
   ```
   JUSTDO_API_URL=https://www.justdo.co.kr
   JUSTDO_API_TOKEN=jd_int_…
   ```
3. Vercel은 Redeploy. 확인하려면 앱에 로그인한 상태에서 `POST /api/justdo/sync`.

끊으려면 justdo의 외부 연동에서 **연결 끊기**를 누릅니다.
