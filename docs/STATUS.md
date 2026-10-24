# 진행 상황 (총괄 기록)

## 2026-10-24 마감 시점
- **배포**: https://get-a-job-indol.vercel.app (Vercel, main 브랜치 자동 배포, 지역 sin1). 저장소 https://github.com/xxxxKangxxxx/get_a_job (비공개).
- **DB**: Neon(get-a-job, Singapore). 마이그레이션 0000~0002 적용, 공고 595 / 진행중 71 / 지원현황 25.
- **백엔드 완료·병합**: 실제 DB queries·actions, 받은편지함·숨김 규칙, 일정 계산(plan.ts). 테스트 34개 통과.
- **인프라 완료·병합**: 비밀번호 잠금, 구글 캘린더 연동(사용자 연결 완료, "취업 일정" 캘린더 생성), 웹 푸시, 매일 08:00 cron, /privacy. Vercel 환경변수 모두 설정됨.
- **프론트엔드 진행 중** (Orca task_b9b3611e515e, 브랜치 frontend, 대기 상태):
  - 시안 캔버스 https://claude.ai/artifact/S8XQkRpenKw97FUvks4Cvg — 맨 아래 두 줄이 최신 "홈 일·주·월" 시안(D20 조합). **사용자 검토 대기.**
  - 승인 후: 받은함·일정·지원현황·공고·설정 화면 시안 → tokens.md·components.md → 화면 구현.

## 내일 할 일
1. 사용자에게 홈 일·주·월 시안 피드백 받기 → 프론트엔드 작업자에게 전달.
2. 프론트엔드 화면 구현 후 병합·배포. /settings 화면이 생기면 구글 연결 후 404 해결.
3. 폰에서 홈 화면 추가 → 푸시 켜기 → 테스트 푸시 (프론트 알림 버튼·public/icons 필요).
4. 다음 기능 후보: 공고 붙여넣기 자동 추출(Claude API), 수집 조건 내보내기(숨김 규칙 → Claude 수집).

## 참고
- Orca Run `run_30d4462396b3`. 백엔드·인프라 작업자는 완료·정리됨.
- `.env.local`(비밀값)은 총괄 폴더와 infra worktree에 있음. git에 올라가지 않음.
- 데이터 동기화: 총괄 폴더에서 `pnpm tsx scripts/sync.ts` → Neon 반영.
