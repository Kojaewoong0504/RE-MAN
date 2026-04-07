#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p harness/reports
REPORT_PATH="harness/reports/latest-report.json"
MODE="${1:-pre-commit}"
RETRY_BUDGET="${2:-1}"

if sh scripts/run-save-gate.sh "$MODE" >/tmp/self-repair-loop.log 2>&1; then
  rm -f /tmp/self-repair-loop.log
  printf "Self-repair loop: no failures detected.\n"
  exit 0
fi

python3 scripts/parse_failures.py >/tmp/self-repair-parse.log 2>&1 || true
python3 scripts/retry-agent.py >/tmp/self-repair-context.log 2>&1 || true

printf "Self-repair loop captured failures at %s\n" "$REPORT_PATH"
cat /tmp/self-repair-loop.log
if [ -f harness/reports/normalized-failures.json ]; then
  printf "\nNormalized failures: harness/reports/normalized-failures.json\n"
fi
if [ -f harness/reports/repair-context.json ]; then
  printf "Repair context: harness/reports/repair-context.json\n"
fi

if python3 scripts/codex_repair_runner.py "$MODE" "$RETRY_BUDGET"; then
  printf "Self-repair loop: repair succeeded.\n"
  rm -f /tmp/self-repair-loop.log /tmp/self-repair-parse.log /tmp/self-repair-context.log
  exit 0
fi

rm -f /tmp/self-repair-loop.log /tmp/self-repair-parse.log /tmp/self-repair-context.log
exit 1
