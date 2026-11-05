# 선택 기능: justdo 연동

[justdo](https://www.justdo.co.kr)를 쓰면, 지원하기로 한 공고의 **서류 접수 기간**이 justdo "취업" 카테고리에 할 일로 자동으로 들어갑니다.

- 지원 예정 → 접수 시작일~마감일 할 일 / 제출 완료 → 그 할 일이 완료로 바뀜
- 지원을 취소하면 justdo에서도 빠집니다(완료했거나 마감이 지난 할 일은 남음)
- 보내는 때: 앱에서 결정을 바꿀 때마다(지원·제출 완료·지원 취소), `pnpm track` 실행 뒤, `pnpm justdo` 실행 때, 매일 08:00(배포한 경우만)
- **마감이 남은 "지원 예정"·"제출 완료" 공고만 보냅니다.** 토큰을 넣기만 하고 [지원]으로 고른 공고가 없으면 justdo에는 아무것도 생기지 않아요.

## 켜기
1. justdo 웹 → **설정 → 외부 연동** → 서비스 "취업 일정 (get_a_job)" → **토큰 만들기** → 복사 (한 번만 보입니다)
2. `.env.local`과 Vercel 환경변수에:
   ```
   JUSTDO_API_URL=https://www.justdo.co.kr
   JUSTDO_API_TOKEN=jd_int_…
   ```
3. 실행 중인 `pnpm dev`가 있으면 껐다가 다시 켭니다. Vercel은 Redeploy.
4. 터미널에서 확인:
   ```bash
   pnpm justdo
   ```
   `✅ justdo에 연결됐어요`가 나오면 끝입니다. 이미 [지원]으로 고른 공고가 있으면 이때 한꺼번에 들어갑니다.
   "보낼 공고가 아직 없어요"가 나오면 앱에서 마감이 남은 공고를 [지원]으로 골라 보세요.

## 안 될 때
- `pnpm justdo`가 알려 주는 이유를 먼저 보세요.
  - **401 / 토큰이 틀렸어요**: 토큰을 다시 만들어 붙여넣기(앞뒤 공백·따옴표 없이, `JUSTDO_API_TOKEN=jd_int_…` 한 줄)
  - **주소에 닿지 못했어요**: `JUSTDO_API_URL=https://www.justdo.co.kr` 확인
- 앱에서 [지원]을 눌렀을 때 실패하면 `pnpm dev`를 띄운 터미널에 `[justdo] sync failed …`가 찍힙니다.
- 배포한 앱에서는 로그인한 상태로 `POST /api/justdo/sync`를 호출해도 바로 보냅니다.

끊으려면 justdo의 외부 연동에서 **연결 끊기**를 누릅니다.
