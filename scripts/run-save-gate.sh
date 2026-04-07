#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

run_check() {
  name="$1"
  command="$2"

  if sh -c "$command" >/tmp/"$name".log 2>&1; then
    printf "PASS %s\n" "$name"
    rm -f /tmp/"$name".log
    return 0
  fi

  printf "FAIL %s\n" "$name"
  cat /tmp/"$name".log
  rm -f /tmp/"$name".log
  return 1
}

run_check "repository-harness" "python3 harness/repository/run.py"
run_check "application-harness" "python3 harness/application/run.py"

printf "Save gate passed.\n"
