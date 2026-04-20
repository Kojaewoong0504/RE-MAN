#!/usr/bin/env python3

import base64
import hashlib
import hmac
import json
import struct
import sys
import time
import urllib.error
import urllib.request
import zlib
from os import environ
from pathlib import Path


BASE_URL = environ.get("SMOKE_BASE_URL", "http://127.0.0.1:3001")
TIMEOUT_SECONDS = int(environ.get("SMOKE_TIMEOUT_SECONDS", "70"))


def load_env_value(name: str, fallback: str = "") -> str:
    if environ.get(name):
        return environ[name]

    for env_file in [".env.vercel.local", ".env.local"]:
        path = Path(env_file)
        if not path.exists():
            continue

        for line in path.read_text().splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue

            key, value = stripped.split("=", 1)
            if key.strip() != name:
                continue

            value = value.strip()
            if (
                (value.startswith('"') and value.endswith('"'))
                or (value.startswith("'") and value.endswith("'"))
            ):
                value = value[1:-1]
            return value

    return fallback


AUTH_JWT_SECRET = load_env_value("AUTH_JWT_SECRET")


def base64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def issue_smoke_access_token() -> str:
    if not AUTH_JWT_SECRET:
        raise RuntimeError("missing AUTH_JWT_SECRET")

    now = int(time.time())
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "type": "access",
        "sub": "closet-gemini-smoke-user",
        "email": "closet-gemini-smoke@example.com",
        "name": "Closet Gemini Smoke User",
        "picture": None,
        "provider": "google",
        "iat": now,
        "exp": now + 900,
    }
    signing_input = ".".join(
        [
            base64url(json.dumps(header, separators=(",", ":")).encode("utf-8")),
            base64url(json.dumps(payload, separators=(",", ":")).encode("utf-8")),
        ]
    )
    signature = hmac.new(
        AUTH_JWT_SECRET.encode("utf-8"),
        signing_input.encode("ascii"),
        hashlib.sha256,
    ).digest()

    return f"{signing_input}.{base64url(signature)}"


def png_chunk(kind: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + kind
        + data
        + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
    )


def build_clothing_like_png(width: int = 256, height: int = 256) -> str:
    rows = []

    for y in range(height):
        row = bytearray([0])
        for x in range(width):
            in_shirt = 48 < x < 208 and 28 < y < 160
            in_sleeve = (24 < x <= 48 or 208 <= x < 232) and 52 < y < 132
            in_label = 112 < x < 144 and 48 < y < 70

            if in_label:
                row.extend((245, 245, 235))
            elif in_shirt or in_sleeve:
                row.extend((32, 70, 130))
            else:
                row.extend((238, 232, 220))
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
        headers={
            "Content-Type": "application/json",
            "Cookie": f"reman_access_token={issue_smoke_access_token()}",
            "Idempotency-Key": f"closet-smoke-{int(time.time())}",
        },
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
    status, data = post_json(
        "/api/closet/analyze",
        {"image": f"data:image/png;base64,{build_clothing_like_png()}"},
    )
    duration_ms = round((time.time() - started) * 1000)

    if status != 200:
        print(
            json.dumps(
                {
                    "ok": False,
                    "status": status,
                    "duration_ms": duration_ms,
                    "error": data,
                },
                ensure_ascii=False,
            )
        )
        return 1

    required = [
        "name",
        "color",
        "detected_type",
        "analysis_confidence",
        "size_source",
        "credits_charged",
        "credits_remaining",
        "credit_reference_id",
    ]
    missing = [field for field in required if field not in data]

    if missing or data.get("credits_charged") != 1:
        print(
            json.dumps(
                {
                    "ok": False,
                    "status": status,
                    "duration_ms": duration_ms,
                    "error": "invalid closet smoke response",
                    "missing": missing,
                    "credits_charged": data.get("credits_charged"),
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
                "name": data.get("name"),
                "category": data.get("category"),
                "size_source": data.get("size_source"),
                "credits_charged": data.get("credits_charged"),
                "credits_remaining": data.get("credits_remaining"),
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
