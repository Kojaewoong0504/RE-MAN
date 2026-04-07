#!/bin/sh
set -eu

if ! git rev-parse --show-toplevel >/dev/null 2>&1; then
  printf "FAIL setup-githooks\n"
  printf "  not a git repository\n"
  exit 1
fi

git config core.hooksPath .githooks
chmod +x .githooks/pre-commit .githooks/pre-push scripts/run-save-gate.sh scripts/setup-githooks.sh

printf "Git hooks configured at .githooks\n"
