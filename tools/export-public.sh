#!/usr/bin/env bash
# 비공개 저장소(이곳)의 master를 공개 저장소 github.com/xxxxKangxxxx/get-a-job 에 내보낸다.
# 개인 기록(docs/STATUS·DECISIONS·PLAN·handoff·infra)과 tools/는 빼고, 새 커밋 하나로 올린다.
#   사용법: tools/export-public.sh "커밋 메시지"
set -euo pipefail
MSG="${1:?커밋 메시지를 주세요}"
SRC="$(git rev-parse --show-toplevel)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

git clone -q https://github.com/xxxxKangxxxx/get-a-job.git "$WORK/pub"
find "$WORK/pub" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
git -C "$SRC" archive master | tar -x -C "$WORK/pub"

cd "$WORK/pub"
rm -rf docs/STATUS.md docs/DECISIONS.md docs/PLAN.md docs/handoff docs/infra tools

if grep -rnI -E "kang071911|yeongmo|/Users/|indol|2026 취업하기|총괄" . --exclude-dir=.git --exclude=pnpm-lock.yaml; then
  echo "!! 개인 정보로 보이는 값이 있어 멈춘다"; exit 1
fi

git add -A
if git diff --cached --quiet; then echo "바뀐 것 없음"; exit 0; fi
git -c user.name="xxxxKangxxxx" -c user.email="163852010+xxxxKangxxxx@users.noreply.github.com" commit -qm "$MSG"
git push -q origin main
echo "공개 저장소에 올림: $(git log --oneline -1)"
