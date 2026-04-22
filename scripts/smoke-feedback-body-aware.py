#!/usr/bin/env python3

import json
import sys
import time
import urllib.error
import urllib.request
from os import environ


BASE_URL = environ.get("SMOKE_BASE_URL", "http://127.0.0.1:3001")
TIMEOUT_SECONDS = int(environ.get("SMOKE_TIMEOUT_SECONDS", "90"))


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
        "payload": {
            "text_description": (
                "상체가 먼저 보이고 흰 티셔츠와 어두운 하의 대비가 큽니다. "
                "덩치가 덜 부각되고 더 정돈된 인상을 원합니다."
            ),
            "survey": {
                "current_style": "흰 티셔츠 + 어두운 하의",
                "motivation": "소개팅 / 이성 만남",
                "budget": "15~30만원",
                "style_goal": "덩치가 덜 부각되는 정리된 인상",
                "confidence_level": "배우는 중",
            },
            "feedback_history": [],
        },
        "debug": True,
    }
    status, data = post_json("/api/dev/gemini", payload)
    duration_ms = round((time.time() - started) * 1000)

    if status != 200:
        print(
            json.dumps(
                {
                    "ok": False,
                    "status": status,
                    "duration_ms": duration_ms,
                    "error": data,
                    "hint": "Start `npm run dev` on port 3001 with AI_PROVIDER=gemini before claiming body-aware Gemini feedback works.",
                },
                ensure_ascii=False,
            )
        )
        return 1

    if not data.get("valid"):
        print(
            json.dumps(
                {
                    "ok": False,
                    "status": status,
                    "duration_ms": duration_ms,
                    "error": "gemini_body_aware_response_invalid",
                    "raw": data.get("raw"),
                    "stabilized": data.get("stabilized"),
                },
                ensure_ascii=False,
            )
        )
        return 1

    normalized = data.get("normalized")
    if not isinstance(normalized, dict):
        print(
            json.dumps(
                {
                    "ok": False,
                    "status": status,
                    "duration_ms": duration_ms,
                    "error": "normalized_result_missing",
                },
                ensure_ascii=False,
            )
        )
        return 1

    body_profile = normalized.get("body_profile")
    if not isinstance(body_profile, dict):
        print(
            json.dumps(
                {
                    "ok": False,
                    "status": status,
                    "duration_ms": duration_ms,
                    "error": "body_profile_missing",
                    "normalized": normalized,
                },
                ensure_ascii=False,
            )
        )
        return 1

    fit_risk_tags = body_profile.get("fit_risk_tags")
    risk_tags = fit_risk_tags if isinstance(fit_risk_tags, list) else []
    errors: list[str] = []

    if body_profile.get("upper_body_presence") != "high":
        errors.append(
            f"upper_body_presence expected 'high', got {body_profile.get('upper_body_presence')!r}"
        )

    if body_profile.get("overall_frame") != "large":
        errors.append(
            f"overall_frame expected 'large', got {body_profile.get('overall_frame')!r}"
        )

    if "strong_contrast_split_risk" not in risk_tags:
        errors.append("fit_risk_tags must include 'strong_contrast_split_risk'")

    if errors:
        print(
            json.dumps(
                {
                    "ok": False,
                    "status": status,
                    "duration_ms": duration_ms,
                    "error": "body_aware_signals_too_weak",
                    "details": errors,
                    "body_profile": body_profile,
                    "normalized": normalized,
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
                "body_profile": body_profile,
                "recommended_outfit": normalized.get("recommended_outfit"),
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
