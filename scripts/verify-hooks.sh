#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

TARGET="harness/application/fixtures/onboarding-agent.valid.json"
BACKUP="$(mktemp)"
cp "$TARGET" "$BACKUP"

cleanup() {
  mv "$BACKUP" "$TARGET"
}

trap cleanup EXIT

cat >"$TARGET" <<'EOF'
{
  "diagnosis": "왜 이렇게 입었어요",
  "improvements": [
    "바지 핏을 조금 더 곧게 잡으면 전체가 더 깔끔해 보여요.",
    "상의에 얇은 레이어 하나만 더하면 단조로운 느낌이 줄어요.",
    "신발 색을 상의나 하의 중 하나와 맞추면 정리가 더 잘 돼요."
  ],
  "today_action": "지금 가진 옷 중 가장 깔끔한 바지와 상의를 한 번 다시 조합해보세요.",
  "day1_mission": "옷장에 있는 옷을 전부 꺼내서 바닥에 펼쳐보고 사진을 찍어보세요."
}
EOF

if ./.githooks/pre-commit >/tmp/verify-hooks.log 2>&1; then
  printf "FAIL hook-verification\n"
  printf "  pre-commit should have failed but passed\n"
  cat /tmp/verify-hooks.log
  rm -f /tmp/verify-hooks.log
  exit 1
fi

printf "PASS hook-verification\n"
cat /tmp/verify-hooks.log
rm -f /tmp/verify-hooks.log
