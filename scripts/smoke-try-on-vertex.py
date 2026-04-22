#!/usr/bin/env python3

import base64
import hashlib
import hmac
import json
import struct
import time
import urllib.error
import urllib.request
import zlib
from os import environ
from pathlib import Path


BASE_URL = environ.get("SMOKE_BASE_URL", "http://127.0.0.1:3001")
TIMEOUT_SECONDS = int(environ.get("SMOKE_TIMEOUT_SECONDS", "90"))


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


AUTH_JWT_SECRET = load_env_value("AUTH_JWT_SECRET", "development-auth-secret-change-me")


def base64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def issue_smoke_access_token() -> str:
    now = int(time.time())
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "type": "access",
        "sub": "try-on-smoke-user",
        "email": "try-on-smoke@example.com",
        "name": "Try On Smoke User",
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


def build_person_like_png(width: int = 512, height: int = 768) -> str:
    rows = []

    for y in range(height):
        row = bytearray([0])
        for x in range(width):
            bg = (242, 236, 225)
            in_head = (x - width // 2) ** 2 + (y - 118) ** 2 < 54**2
            in_torso = 176 < x < 336 and 178 < y < 470
            in_left_arm = 124 < x < 176 and 210 < y < 438
            in_right_arm = 336 < x < 388 and 210 < y < 438
            in_left_leg = 198 < x < 246 and 470 <= y < 700
            in_right_leg = 266 < x < 314 and 470 <= y < 700
            in_shoes = 176 < x < 336 and 700 <= y < 734

            if in_head:
                row.extend((220, 190, 165))
            elif in_torso or in_left_arm or in_right_arm:
                row.extend((32, 70, 130))
            elif in_left_leg or in_right_leg:
                row.extend((32, 39, 53))
            elif in_shoes:
                row.extend((245, 245, 238))
            else:
                row.extend(bg)
        rows.append(bytes(row))

    raw = b"".join(rows)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
        + png_chunk(b"IDAT", zlib.compress(raw, 9))
        + png_chunk(b"IEND", b"")
    )

    return base64.b64encode(png).decode("ascii")


def build_product_like_png(width: int = 512, height: int = 768) -> str:
    rows = []

    for y in range(height):
        row = bytearray([0])
        for x in range(width):
            bg = (246, 241, 232)
            in_jacket = 146 < x < 366 and 154 < y < 512
            in_lapel = 208 < x < 304 and 154 < y < 274
            in_pants_left = 190 < x < 244 and 512 <= y < 706
            in_pants_right = 268 < x < 322 and 512 <= y < 706
            in_shoes = 176 < x < 336 and 706 <= y < 734

            if in_lapel:
                row.extend((230, 228, 220))
            elif in_jacket:
                row.extend((34, 40, 52))
            elif in_pants_left or in_pants_right:
                row.extend((22, 28, 36))
            elif in_shoes:
                row.extend((244, 244, 238))
            else:
                row.extend(bg)
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
            "Idempotency-Key": f"try-on-smoke-{int(time.time())}",
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
    product_images = [
        f"data:image/png;base64,{build_product_like_png()}",
        f"data:image/png;base64,{build_product_like_png(480, 720)}",
        f"data:image/png;base64,{build_product_like_png(448, 672)}",
    ]
    payload = {
        "person_image": f"data:image/png;base64,{build_person_like_png()}",
        "product_images": product_images,
        "prompt": "전신 정면 사진 기준 자연스러운 실착 미리보기",
    }
    status, data = post_json("/api/try-on", payload)
    duration_ms = round((time.time() - started) * 1000)

    if status != 200:
        print(
            json.dumps(
                {
                    "ok": False,
                    "status": status,
                    "duration_ms": duration_ms,
                    "error": data,
                    "hint": "Start `npm run dev` on port 3001 with TRY_ON_PROVIDER=vertex and valid Vertex auth before claiming real try-on works.",
                },
                ensure_ascii=False,
            )
        )
        return 1

    required = [
        "status",
        "preview_image",
        "message",
        "credits_remaining",
        "credits_charged",
        "credit_reference_id",
        "try_on_pass_count",
    ]
    missing = [field for field in required if field not in data]

    if missing:
        print(
            json.dumps(
                {
                    "ok": False,
                    "status": status,
                    "duration_ms": duration_ms,
                    "error": "invalid try-on smoke response",
                    "missing": missing,
                },
                ensure_ascii=False,
            )
        )
        return 1

    if data.get("status") != "vertex":
      print(
            json.dumps(
                {
                    "ok": False,
                    "status": status,
                    "duration_ms": duration_ms,
                    "error": "try-on provider did not return vertex",
                    "provider_status": data.get("status"),
                },
                ensure_ascii=False,
            )
        )
      return 1

    preview = data.get("preview_image")
    if not isinstance(preview, str) or not preview.startswith("data:image/"):
        print(
            json.dumps(
                {
                    "ok": False,
                    "status": status,
                    "duration_ms": duration_ms,
                    "error": "preview_image is not a data image",
                },
                ensure_ascii=False,
            )
        )
        return 1

    expected_pass_count = len(product_images)

    if data.get("credits_charged") != expected_pass_count:
        print(
            json.dumps(
                {
                    "ok": False,
                    "status": status,
                    "duration_ms": duration_ms,
                    "error": "unexpected credit charge",
                    "credits_charged": data.get("credits_charged"),
                    "credits_remaining": data.get("credits_remaining"),
                    "expected_pass_count": expected_pass_count,
                },
                ensure_ascii=False,
            )
        )
        return 1

    if data.get("try_on_pass_count") != expected_pass_count:
        print(
            json.dumps(
                {
                    "ok": False,
                    "status": status,
                    "duration_ms": duration_ms,
                    "error": "unexpected try_on_pass_count",
                    "try_on_pass_count": data.get("try_on_pass_count"),
                    "expected_pass_count": expected_pass_count,
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
                "provider_status": data.get("status"),
                "credits_charged": data.get("credits_charged"),
                "credits_remaining": data.get("credits_remaining"),
                "preview_length": len(preview),
                "message": data.get("message"),
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
