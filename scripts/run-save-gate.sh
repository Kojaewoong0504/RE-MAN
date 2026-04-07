#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

MODE="${1:-pre-commit}"
python3 scripts/run-save-gate.py "$MODE"
