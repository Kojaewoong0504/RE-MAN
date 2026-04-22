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


AUTH_JWT_SECRET = load_env_value("AUTH_JWT_SECRET", "development-auth-secret-change-me")


def base64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def issue_smoke_access_token() -> str:
    now = int(time.time())
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "type": "access",
        "sub": "gemini-smoke-user",
        "email": "gemini-smoke@example.com",
        "name": "Gemini Smoke User",
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
        headers={
            "Content-Type": "application/json",
            "Cookie": f"reman_access_token={issue_smoke_access_token()}",
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


def build_expected_source_item_ids(payload: dict) -> dict[str, str]:
    expected: dict[str, str] = {}

    for item in payload.get("closet_items", []):
        category = item.get("category")
        item_id = item.get("id")

        if category in {"tops", "bottoms", "shoes", "outerwear"} and isinstance(item_id, str):
            expected[category] = item_id

    return expected


def validate_source_item_ids(data: dict, expected: dict[str, str]) -> list[str]:
    recommended_outfit = data.get("recommended_outfit")

    if not isinstance(recommended_outfit, dict):
        return ["recommended_outfit is not an object"]

    source_item_ids = recommended_outfit.get("source_item_ids")

    if not isinstance(source_item_ids, dict):
        return ["recommended_outfit.source_item_ids is missing or not an object"]

    errors = []
    for category, expected_id in expected.items():
        actual_id = source_item_ids.get(category)
        if actual_id != expected_id:
            errors.append(
                f"source_item_ids.{category} expected {expected_id}, got {actual_id!r}"
            )

    return errors


def validate_body_aware_fields(data: dict) -> list[str]:
    errors: list[str] = []

    body_profile = data.get("body_profile")
    if not isinstance(body_profile, dict):
        return ["body_profile is missing or not an object"]

    qualitative_fields = [
        "upper_body_presence",
        "lower_body_balance",
        "belly_visibility",
        "leg_length_impression",
        "shoulder_shape",
        "neck_impression",
        "overall_frame",
    ]
    has_any_signal = any(
        isinstance(body_profile.get(field), str) and body_profile.get(field, "").strip()
        for field in qualitative_fields
    )

    if not has_any_signal:
        errors.append("body_profile does not contain any qualitative signal")

    fit_risk_tags = body_profile.get("fit_risk_tags")
    if fit_risk_tags is not None and not (
        isinstance(fit_risk_tags, list)
        and all(isinstance(item, str) and item.strip() for item in fit_risk_tags)
    ):
        errors.append("body_profile.fit_risk_tags is not a valid string array")

    recommended_outfit = data.get("recommended_outfit")
    if not isinstance(recommended_outfit, dict):
        errors.append("recommended_outfit is missing or not an object")
        return errors

    for field in ["safety_basis", "avoid_notes"]:
        value = recommended_outfit.get(field)
        if not (
            isinstance(value, list)
            and len(value) == 3
            and all(isinstance(item, str) and item.strip() for item in value)
        ):
            errors.append(f"recommended_outfit.{field} must be a 3-item string array")

    return errors


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
            "tops": "네이비 셔츠",
            "bottoms": "검정 슬랙스",
            "shoes": "흰색 스니커즈",
            "outerwear": "차콜 자켓",
        },
        "closet_items": [
            {
                "id": "smoke-top-1",
                "category": "tops",
                "name": "네이비 셔츠",
                "color": "네이비",
                "fit": "레귤러",
                "size": "L",
                "wear_state": "잘 맞음",
            },
            {
                "id": "smoke-bottom-1",
                "category": "bottoms",
                "name": "검정 슬랙스",
                "color": "검정",
                "fit": "스트레이트",
                "size": "32",
                "wear_state": "잘 맞음",
            },
            {
                "id": "smoke-shoes-1",
                "category": "shoes",
                "name": "흰색 스니커즈",
                "color": "흰색",
                "size": "270",
                "wear_state": "보통",
            },
        ],
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

    required = [
        "diagnosis",
        "improvements",
        "recommended_outfit",
        "today_action",
        "day1_mission",
        "credits_charged",
        "credits_remaining",
        "credit_reference_id",
    ]
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

    expected_source_item_ids = build_expected_source_item_ids(payload)
    source_item_id_errors = validate_source_item_ids(data, expected_source_item_ids)
    if source_item_id_errors:
        print(
            json.dumps(
                {
                    "ok": False,
                    "status": status,
                    "duration_ms": duration_ms,
                    "error": "invalid source_item_ids",
                    "details": source_item_id_errors,
                    "expected_source_item_ids": expected_source_item_ids,
                    "actual_source_item_ids": data.get("recommended_outfit", {}).get(
                        "source_item_ids"
                    )
                    if isinstance(data.get("recommended_outfit"), dict)
                    else None,
                    "hint": "Gemini must return the registered closet item ids it used in recommended_outfit.source_item_ids.",
                },
                ensure_ascii=False,
            )
        )
        return 1

    body_aware_errors = validate_body_aware_fields(data)
    if body_aware_errors:
        print(
            json.dumps(
                {
                    "ok": False,
                    "status": status,
                    "duration_ms": duration_ms,
                    "error": "invalid body-aware fields",
                    "details": body_aware_errors,
                    "body_profile": data.get("body_profile"),
                    "recommended_outfit": data.get("recommended_outfit"),
                    "hint": "Gemini must return body_profile plus recommended_outfit.safety_basis and avoid_notes.",
                },
                ensure_ascii=False,
            )
        )
        return 1

    if data.get("credits_charged") != 1:
        print(
            json.dumps(
                {
                    "ok": False,
                    "status": status,
                    "duration_ms": duration_ms,
                    "error": "style feedback did not charge exactly one credit",
                    "credits_charged": data.get("credits_charged"),
                    "credits_remaining": data.get("credits_remaining"),
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
                "body_profile": data.get("body_profile"),
                "recommended_outfit": data["recommended_outfit"].get("title"),
                "safety_basis": data["recommended_outfit"].get("safety_basis"),
                "avoid_notes": data["recommended_outfit"].get("avoid_notes"),
                "source_item_ids": data["recommended_outfit"].get("source_item_ids"),
                "credits_charged": data.get("credits_charged"),
                "credits_remaining": data.get("credits_remaining"),
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
