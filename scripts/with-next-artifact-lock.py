#!/usr/bin/env python3

import os
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LOCK_PATH = ROOT / ".next-harness.lock"


def usage() -> int:
    print(
        "Usage: python3 scripts/with-next-artifact-lock.py <label> -- <command...>",
        file=sys.stderr,
    )
    return 2


def build_env() -> dict[str, str]:
    env = os.environ.copy()
    env["PATH"] = f"/opt/homebrew/bin:/usr/local/bin:{env.get('PATH', '')}"
    return env


def read_lock_owner() -> str:
    try:
        return LOCK_PATH.read_text(encoding="utf-8").strip()
    except OSError:
        return "unknown"


def main() -> int:
    if len(sys.argv) < 4 or sys.argv[2] != "--":
        return usage()

    label = sys.argv[1]
    command = sys.argv[3:]
    lock_fd: int | None = None

    try:
        lock_fd = os.open(LOCK_PATH, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        os.write(lock_fd, f"{label} pid={os.getpid()}\n".encode("utf-8"))
        os.close(lock_fd)
        lock_fd = None
    except FileExistsError:
        owner = read_lock_owner()
        print(
            "Next artifact gate is already running. "
            f"Current: {label}. Existing: {owner}. "
            "Do not run build, Playwright E2E, or visual smoke in parallel.",
            file=sys.stderr,
        )
        return 1

    try:
        return subprocess.run(command, cwd=ROOT, env=build_env()).returncode
    finally:
        if lock_fd is not None:
            os.close(lock_fd)
        try:
            LOCK_PATH.unlink()
        except FileNotFoundError:
            pass


if __name__ == "__main__":
    raise SystemExit(main())
