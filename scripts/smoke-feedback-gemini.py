#!/usr/bin/env python3

import base64
import json
import struct
import sys
import time
import urllib.error
import urllib.request
import zlib
from os import environ


BASE_URL = environ.get("SMOKE_BASE_URL", "http://127.0.0.1:3001")
TIMEOUT_SECONDS = int(environ.get("SMOKE_TIMEOUT_SECONDS", "70"))


def png_chunk(kind: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + kind
        + data
        + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
    )


def build_test_png(width: int = 256, height: int = 256) -> str:
    rows = []

    for y in range(height):
        row = bytearray([0])
        for x in range(width):
            row.extend((x % 256, y % 256, (x + y) % 256))
        rows.append(bytes(row))

    raw = b"".join(rows)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
        + png_chunk(b"IDAT", zlib.compress(raw, 9))
        + png_chunk(b"IEND", b"")
    )

    return base64.b64encode(png).decode("ascii")


def post_json(path: str, payload: dict) -> tuple[int, dict]:
    request = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            data = {"raw": body}
        return error.code, data


def main() -> int:
    started = time.time()
    payload = {
        "image": f"data:image/png;base64,{build_test_png()}",
        "survey": {
            "current_style": "청바지 + 무지 티셔츠",
            "motivation": "소개팅 / 이성 만남",
            "budget": "15~30만원",
            "style_goal": "전체적인 스타일 리셋",
            "confidence_level": "배우는 중",
        },
        "closet_profile": {
            "tops": "무지 티셔츠, 후드티",
            "bottoms": "청바지",
            "shoes": "흰색 스니커즈",
        },
        "feedback_history": [],
    }
    status, data = post_json("/api/feedback", payload)
    duration_ms = round((time.time() - started) * 1000)

    if status != 200:
        print(
            json.dumps(
                {
                    "ok": False,
                    "status": status,
                    "duration_ms": duration_ms,
                    "error": data,
                    "hint": "Start `npm run dev` on port 3001 with AI_PROVIDER=gemini before claiming real Gemini feedback works.",
                },
                ensure_ascii=False,
            )
        )
        return 1

    required = ["diagnosis", "improvements", "recommended_outfit", "today_action", "day1_mission"]
    missing = [field for field in required if field not in data]
    if missing:
        print(
            json.dumps(
                {
                    "ok": False,
                    "status": status,
                    "duration_ms": duration_ms,
                    "error": f"missing fields: {', '.join(missing)}",
                },
                ensure_ascii=False,
            )
        )
        return 1

    print(
        json.dumps(
            {
                "ok": True,
                "status": status,
                "duration_ms": duration_ms,
                "recommended_outfit": data["recommended_outfit"].get("title"),
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
