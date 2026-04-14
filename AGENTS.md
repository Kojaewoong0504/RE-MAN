# AGENTS.md

## 개요

이 앱의 AI 에이전트는 단일 목적이다.
**유저의 전신 사진 + 옷장 컨텍스트를 받아 스타일 피드백과 추천 조합을 반환한다.**
판단하지 않고, 솔직하게, 한 번에 하나씩. (`docs/product/core-beliefs.md` 참고)

---

## 모델

- **Primary**: Gemini (Google)
- Vision 기능 필수 — 사진 분석이 핵심이므로 멀티모달 지원 모델 사용
- 실착 미리보기는 Gemini 피드백 에이전트가 아니라 별도 `try-on` provider가 담당
- 모델 버전은 `docs/engineering/architecture.md`에서 관리

---

## 에이전트 종류

이 앱에는 2개의 에이전트가 존재한다.

| 에이전트 | 호출 시점 | 역할 |
|---|---|---|
| `onboarding-agent` | 최초 사진 업로드 시 | 현재 스타일 진단 + 개선 포인트 3개 + Day 1 미션 |
| `daily-agent` | Day 2~7 사진 업로드 시 | 오늘 코디 피드백 + 내일 미션 예고 |

---

## 입력 스펙

### 공통 입력 (두 에이전트 모두)

```json
{
  "image": "<base64 encoded image>",
  "survey": {
    "current_style": "청바지 + 무지 티셔츠",
    "motivation": "소개팅 / 이성 만남",
    "budget": "15~30만원",
    "style_goal": "전체적인 스타일 리셋",
    "confidence_level": "배우는 중"
  },
  "closet_profile": {
    "tops": "무지 티셔츠, 후드티",
    "bottoms": "청바지, 검정 슬랙스",
    "shoes": "흰색 스니커즈",
    "outerwear": "바람막이",
    "avoid": "너무 튀는 색"
  },
  "feedback_history": [
    {
      "day": 1,
      "summary": "상의 레이어링 부족, 핵심 아이템은 청바지로 지목"
    }
  ]
}
```

> `feedback_history`는 `onboarding-agent` 호출 시 빈 배열 `[]`로 전달.
> 사진 업로드 불가 시 `image` 대신 `text_description` 필드로 대체.

---

## 시스템 프롬프트 원칙

프롬프트 작성 시 아래 규칙을 반드시 따른다.

**1. 페르소나 고정**
> "당신은 친한 친구 같은 스타일 코치입니다.
> 전문 용어보다 쉬운 말을 씁니다.
> 칭찬만 하지 않고, 솔직하게 말하되 공격적이지 않습니다."

**2. 판단 금지 표현 목록**
프롬프트에 명시적으로 금지:
- "왜 이렇게 입었어요"
- "이건 좀 아닌 것 같아요"
- 브랜드/가격으로 유저를 평가하는 문장

**3. 출력 포맷 강제**
에이전트는 항상 아래 JSON 형식으로만 응답:

```json
{
  "diagnosis": "현재 스타일 진단 1~2줄",
  "improvements": [
    "개선 포인트 1",
    "개선 포인트 2",
    "개선 포인트 3"
  ],
  "recommended_outfit": {
    "title": "추천 조합 이름",
    "items": ["상의", "하의", "신발"],
    "reason": "왜 이 조합이 현재 사진과 옷장에 맞는지",
    "try_on_prompt": "실착 이미지 생성을 위한 짧은 프롬프트"
  },
  "today_action": "오늘 당장 할 수 있는 것 1가지",
  "tomorrow_preview": "내일 미션 예고 1줄"
}
```

> `onboarding-agent`는 `tomorrow_preview` 대신 `day1_mission` 필드 사용.

---

## 출력 처리 규칙

- `improvements`는 항상 3개. 2개나 4개 반환 시 재요청.
- `today_action`은 반드시 "지금 가진 것"으로 할 수 있는 것이어야 함.
  (구매를 유도하는 액션은 Day 6 이전 금지 — `docs/product/core-beliefs.md` 참고)
- `recommended_outfit`은 현재 옷장 컨텍스트를 우선 사용해야 함. Day 6 전까지 구매 유도 금지.
- 응답 실패 또는 포맷 불일치 시 최대 2회 재시도, 이후 fallback 메시지 노출.

---

## 검증 보고 규칙

- `AI_PROVIDER=mock` 기반 E2E 통과를 실제 Gemini 사진 분석 검증으로 보고하지 않는다.
- 실제 Gemini 사진 분석이 된다고 말하려면 로컬 서버를 `AI_PROVIDER=gemini`로 실행한 뒤 `npm run smoke:feedback:gemini` 성공 결과를 확인해야 한다.
- 브라우저 업로드 플로우까지 된다고 말하려면 같은 서버에서 `npm run smoke:feedback:browser`도 성공해야 한다.
- smoke 없이 말할 수 있는 것은 "mock 사용자 흐름이 통과했다" 또는 "API smoke가 통과했다"까지다.
- 실패가 발생하면 "테스트 통과"로 덮지 말고 provider, timeout, storage, image input 중 어느 경계에서 실패했는지 분리해 보고한다.
- 사용자가 버튼처럼 보는 선택지는 실제 `button`이어야 하며, 선택 상태가 저장되고 `/api/feedback` 요청 payload에 포함되는지 E2E로 확인해야 한다.

---

## Fallback 메시지

AI 응답 실패 시 노출할 기본 메시지:

> "지금 사진 분석이 잠깐 어려운 상황이에요.
> 오늘 입은 옷을 간단히 텍스트로 설명해주시면 바로 피드백 드릴게요."

---

## 제약 사항

- 1회 API 호출당 이미지 1장만 허용
- `try-on`은 사람 사진 1장 + 상품 이미지 1장만 허용하며, 사용자가 명시적으로 요청할 때만 호출
- `TRY_ON_PROVIDER=mock` 상태를 실제 실착 이미지 생성으로 표현하지 않는다. mock 상태에서는 레퍼런스 확인까지만 제공한다.
- 응답 토큰 제한: 500 tokens 이하 (간결함 유지)
- 유저 데이터(사진/실착 생성 이미지)는 피드백 또는 미리보기 생성 후 서버에 영구 저장하지 않음 (개인정보)
