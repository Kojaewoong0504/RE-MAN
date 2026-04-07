#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p harness/reports
REPORT_PATH="harness/reports/latest-report.json"

if sh scripts/run-save-gate.sh >/tmp/self-repair-loop.log 2>&1; then
  rm -f /tmp/self-repair-loop.log
  printf "Self-repair loop: no failures detected.\n"
  exit 0
fi

printf "Self-repair loop captured failures at %s\n" "$REPORT_PATH"
cat /tmp/self-repair-loop.log
rm -f /tmp/self-repair-loop.log
exit 1
