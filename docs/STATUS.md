# 진행 상황 (총괄 기록)

## 2026-10-24 마감 시점
- **배포**: https://get-a-job-indol.vercel.app (Vercel, main 브랜치 자동 배포, 지역 sin1). 저장소 https://github.com/xxxxKangxxxx/get_a_job (비공개).
- **DB**: Neon(get-a-job, Singapore). 마이그레이션 0000~0002 적용, 공고 595 / 진행중 71 / 지원현황 25.
- **백엔드 완료·병합**: 실제 DB queries·actions, 받은편지함·숨김 규칙, 일정 계산(plan.ts). 테스트 34개 통과.
- **인프라 완료·병합**: 비밀번호 잠금, 구글 캘린더 연동(사용자 연결 완료, "취업 일정" 캘린더 생성), 웹 푸시, 매일 08:00 cron, /privacy. Vercel 환경변수 모두 설정됨.
- **프론트엔드 진행 중** (Orca task_b9b3611e515e, 브랜치 frontend, 대기 상태):
  - 시안 캔버스 https://claude.ai/artifact/S8XQkRpenKw97FUvks4Cvg — 맨 아래 두 줄이 최신 "홈 일·주·월" 시안(D20 조합). **사용자 검토 대기.**
  - 승인 후: 받은함·일정·지원현황·공고·설정 화면 시안 → tokens.md·components.md → 화면 구현.

## 2026-10-25 진행
- 5라운드 폐기(D24). 4라운드 6개를 배경 단색판으로 만들어 검토 대기:
  - Claude R4A·B·C 단색(#ECF8E8): 캔버스 https://claude.ai/artifact/S8XQkRpenKw97FUvks4Cvg 의 '4라운드 단색' 페이지 (frontend 55763b5)
  - Codex r4-01·02·03 단색(#E2F0ED, 다크 #183B42): https://claude.ai/artifact/XiqboPRDRiYPB3mqTvg2Fn 맨 위 (frontend-codex 3c10640)
- 다음: 사용자가 홈 하나를 고르면 확정 → 받은함·일정·지원현황·공고·설정 시안.

## 2026-10-30 justdo 연동 (D25)
- 서류 접수 기간을 justdo(https://www.justdo.co.kr) 할 일로 보낸다. 운영 반영 완료: justdo DB 마이그레이션 20261030090000, justdo main 519ea45(Amplify 배포), 연동 토큰 발급(row 58b4dd6c…), get_a_job main b159a85.
- 운영 연결 시험: 테스트 할 일 생성→삭제 확인. 로컬 .env.local에 JUSTDO_API_URL/TOKEN 있음.
- Vercel 환경변수 설정 완료(10/30), 운영 /api/justdo/sync 정상 응답 확인.
- 홈 시안 선택은 연동 뒤로 미룸 (4라운드 단색판 검토 대기).

## 내일 할 일
1. 사용자에게 홈 일·주·월 시안 피드백 받기 → 프론트엔드 작업자에게 전달.
2. 프론트엔드 화면 구현 후 병합·배포. /settings 화면이 생기면 구글 연결 후 404 해결.
3. 폰에서 홈 화면 추가 → 푸시 켜기 → 테스트 푸시 (프론트 알림 버튼·public/icons 필요).
4. 다음 기능 후보: 공고 붙여넣기 자동 추출(Claude API), 수집 조건 내보내기(숨김 규칙 → Claude 수집).

## 참고
- Orca Run `run_30d4462396b3`. 백엔드·인프라 작업자는 완료·정리됨.
- `.env.local`(비밀값)은 총괄 폴더와 infra worktree에 있음. git에 올라가지 않음.
- 데이터 동기화: 총괄 폴더에서 `pnpm tsx scripts/sync.ts` → Neon 반영.
