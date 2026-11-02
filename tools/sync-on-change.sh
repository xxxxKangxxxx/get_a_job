#!/usr/bin/env bash
# 공고 JSON(.env.local의 POSTINGS_JSON)이 바뀌면 launchd가 이 스크립트를 실행한다 → pnpm sync로 운영 DB에 반영.
# 설정: ~/Library/LaunchAgents/com.getajob.sync.plist  로그: ~/Library/Logs/get-a-job-sync.log
set -uo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
cd "$(dirname "$0")/.."
sleep 30   # 공고 조사 작업이 파일을 여러 번 쓰므로 끝날 때까지 잠깐 기다린다
echo "=== $(date '+%F %T') sync"
pnpm --silent sync 2>&1 | grep -E '"새공고"|"자동숨김"|"공고":|Error|error' || true
