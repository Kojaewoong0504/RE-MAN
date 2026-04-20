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

이 앱에는 1개의 기본 에이전트와 1개의 선택형 루틴 에이전트가 존재한다.
기본 제품 경험은 `Style Check Session`이며, 7일 루틴은 사용자가 명시적으로 선택할 때만 진입하는 보조 모드다.

| 에이전트 | 호출 시점 | 역할 |
|---|---|---|
| `onboarding-agent` | 스타일 체크 세션의 사진/텍스트 업로드 시 | 현재 스타일 진단 + 개선 포인트 3개 + 추천 조합 + 오늘 행동 |
| `daily-agent` | 사용자가 선택형 Routine Mode에 진입한 뒤 Day 2~7 사진 업로드 시 | 오늘 코디 피드백 + 다음 체크 예고 |

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
  "closet_items": [
    {
      "id": "top-1",
      "category": "tops",
      "name": "흰색 무지 티셔츠",
      "color": "흰색",
      "fit": "레귤러",
      "size": "L",
      "wear_state": "잘 맞음",
      "wear_frequency": "자주 입음",
      "season": "사계절",
      "condition": "깨끗함",
      "notes": "자주 입음"
    }
  ],
  "closet_strategy": {
    "core_item_ids": ["top-1"],
    "caution_item_ids": [],
    "optional_item_ids": [],
    "items": [
      {
        "id": "top-1",
        "category": "tops",
        "role": "core",
        "reason": "잘 맞음"
      }
    ]
  },
  "feedback_history": [
    {
      "day": 1,
      "summary": "상의 레이어링 부족, 핵심 아이템은 청바지로 지목"
    }
  ],
  "preference_profile": {
    "liked_direction": "네이비 셔츠 조합 방향 선호",
    "avoid_direction": "강한 컬러 조합 방향은 애매함",
    "note": "신발은 덜 튀는 쪽이 좋음",
    "last_reaction": "not_sure"
  }
}
```

> `feedback_history`는 `onboarding-agent` 호출 시 빈 배열 `[]`로 전달.
> 사진 업로드 불가 시 `image` 대신 `text_description` 필드로 대체.
> 단, 이미 스타일 체크 결과가 있는 재체크 세션은 compact `feedback_history`를 전달해 이전 피드백을 개인화 컨텍스트로 사용할 수 있다.
> `preference_profile`은 추천 반응에서 만든 구조화된 개인화 신호다. 좋아한 방향은 유지하고, 피할 방향은 반복하지 않는다.
> 옷장은 현실 옷장 사진을 저장하는 기능이지만, 현재 에이전트 payload에는 옷장 사진 원본을 보내지 않는다. `closet_items`의 카테고리/이름/색/핏/사이즈/착용감/착용 빈도/계절/상태/메모 요약만 사용한다.
> `closet_strategy`는 `closet_items`를 점수 기반으로 기본템(`core`), 주의 필요(`use_with_care`), 선택지(`optional`)로 나눈 추천용 힌트다. 에이전트는 score가 높은 `core`를 우선 쓰고 `use_with_care`는 필요할 때만 확인 포인트로 언급한다.
> `/api/feedback`의 `image`는 사용자의 현재 전신 사진 1장만 의미한다.
> 스타일 분석을 시작하려면 `closet_items`에 상의(`tops`), 하의(`bottoms`), 신발(`shoes`)이 각각 1개 이상 있어야 한다. 겉옷(`outerwear`)은 선택 항목이다.

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
> 단, UI에서는 기본 경로를 7일 루틴처럼 보이게 만들지 않는다. `day1_mission`은 "오늘 바로 할 수 있는 시작 행동"으로 취급하고, Routine Mode는 보조 링크로만 노출한다.

---

## 출력 처리 규칙

- `improvements`는 항상 3개. 2개나 4개 반환 시 재요청.
- `today_action`은 반드시 "지금 가진 것"으로 할 수 있는 것이어야 함.
  (구매를 유도하는 액션은 Day 6 이전 금지 — `docs/product/core-beliefs.md` 참고)
- `recommended_outfit`은 현재 옷장 컨텍스트를 우선 사용해야 함. Day 6 전까지 구매 유도 금지.
- `recommended_outfit.source_item_ids`는 현재 요청의 `closet_items`에 같은 id와 같은 카테고리로 존재할 때만 직접 매칭 근거로 사용한다. 검증되지 않은 id는 제거하고 근거 후보로 낮춘다.
- `closet_strategy.items[].score`는 착용감, 착용 빈도, 계절, 상태, 메모 기반 신뢰 점수다. 깨끗하지만 거의 안 입는 옷을 `core`로 올리면 실패다.
- 추천 근거 UI는 내부 점수나 상태명을 노출하지 않는다. 사용자 label은 `추천에 사용`, `비슷한 후보`, `추가 후보`, `자주 입고 잘 맞음`, `핏/상태 확인`, `후보`처럼 짧게 표시한다.
- 분석 시작 UI는 상의, 하의, 신발이 모두 준비되지 않았으면 비활성화되어야 한다.
- 응답 실패 또는 포맷 불일치 시 최대 2회 재시도, 이후 fallback 메시지 노출.

---

## 검증 보고 규칙

- `AI_PROVIDER=mock` 기반 E2E 통과를 실제 Gemini 사진 분석 검증으로 보고하지 않는다.
- 실제 Gemini 사진 분석이 된다고 말하려면 로컬 서버를 `AI_PROVIDER=gemini`로 실행한 뒤 `npm run smoke:feedback:gemini` 성공 결과를 확인해야 한다.
- 브라우저 업로드 플로우까지 된다고 말하려면 같은 서버에서 `npm run smoke:feedback:browser`도 성공해야 한다.
- smoke 없이 말할 수 있는 것은 "mock 사용자 흐름이 통과했다" 또는 "API smoke가 통과했다"까지다.
- MVP 핵심 경로와 완료 보고 기준은 `docs/product/mvp-critical-path.md`와 `docs/engineering/verification-matrix.md`를 따른다.
- `npm run test:e2e` 통과는 `mock E2E 통과`로만 보고한다.
- `npm run smoke:feedback:gemini` 통과는 `실제 Gemini API 계약 통과`로 보고한다.
- `npm run smoke:feedback:browser` 통과는 `브라우저 업로드와 실제 Gemini 경계 통과`로 보고한다.
- `npm run smoke:closet:gemini` 통과는 `실제 옷장 AI+크레딧 smoke 통과`로 보고한다.
- `npm run visual:app` 산출물을 확인한 경우에만 `UI 배치 확인`으로 보고한다.
- `npm run build` 통과는 `build 통과`로 보고한다.
- 실패가 발생하면 "테스트 통과"로 덮지 말고 provider, timeout, storage, image input 중 어느 경계에서 실패했는지 분리해 보고한다.
- 사용자가 버튼처럼 보는 선택지는 실제 `button`이어야 하며, 선택 상태가 저장되고 `/api/feedback` 요청 payload에 포함되는지 E2E로 확인해야 한다.
- 전역 UI(크레딧 배지, 하단 탭, 계정 버튼)를 수정하면 `npm run visual:app` 캡처와 브라우저 E2E로 실제 표시 여부를 확인해야 한다. 텍스트 assertion만으로 "보인다"고 보고하지 않는다.
- 크레딧 배지는 로그인 사용자의 모든 핵심 앱 화면에서 보여야 한다. 특정 화면에서 사라지면 실패다.
- 크레딧 배지처럼 앱 상태를 보여주는 요소는 앱 헤더/탭 같은 실제 앱 레이아웃 안에 배치한다. 화면 전체 기준 `fixed` 오버레이로 맞추면 데스크톱에서 앱 밖으로 밀리기 쉬우므로 실패다.
- 하단 탭으로 갈 수 있는 핵심 화면(홈, 스타일, 옷장, 기록, 내 정보)을 다시 헤더/하단 보조 버튼으로 반복 연결하지 않는다. 예외는 현재 작업 맥락의 직접 행동(예: 결과 카드의 `결과 보기`)뿐이다.
- `/api/auth/session`은 컴포넌트마다 중복 호출하지 않는다. 같은 브라우저 세션의 앱 내 이동에서 세션 체크가 반복 폭증하면 캐시/세션 상태 공유 결함으로 보고하고 하네스를 고친다.
- `npm run visual:app`, `npm run visual:deep-dive`, `npm run test:e2e`, `npm run build`처럼 `.next` 또는 3001 포트 브라우저 서버를 쓰는 검증은 병렬 실행하지 않는다.
- 위 명령은 `scripts/with-next-artifact-lock.py` 잠금을 통해 병렬 실행을 막아야 한다. 에이전트는 `multi_tool`로 이 명령들을 동시에 실행하지 않는다.
- 크레딧을 차감하는 API는 `Idempotency-Key`로 같은 성공 요청의 중복 차감을 막아야 한다.
- 크레딧/구독/결제와 연결되는 변경은 단위 테스트와 route 통합 테스트로 원장 기록, 환불, 중복 요청을 검증해야 한다.
- 옷장 근거를 수정하면 `source_item_ids`가 실제 `closet_items`에 존재하고 같은 카테고리인지 단위/통합/E2E 중 최소 두 계층에서 검증해야 한다.
- 결과/기록 화면의 옷장 근거에서 `추천에 사용`을 표시하려면 사용자에게도 `옷장 ID 검증`처럼 검증된 근거임을 짧게 보여줘야 한다. 텍스트 후보나 fallback을 직접 사용처럼 보이게 만들면 실패다.
- 옷장 전략을 수정하면 깨끗하지만 거의 안 입는 옷이 `optional`, 불편하거나 오염/수선 필요 옷이 `use_with_care`, 자주 입고 잘 맞는 옷이 `core`로 분류되는지 단위 테스트와 payload E2E로 검증해야 한다.
- 분석 시작 조건을 수정하면 상의만 있는 상태에서 하의/신발 부족 안내가 보이고 `AI 분석 시작하기`가 비활성화되는지 E2E로 검증해야 한다.
- 모바일 사진 업로드를 수정할 때 HEIC/HEIF 같은 모바일 원본 포맷을 "미리보기 불가지만 분석 가능" 같은 저품질 UX로 넘기지 않는다. 가능한 경우 JPEG로 변환해 미리보기와 분석 입력을 같은 정상 경로로 태우고, 변환 실패 시 명확히 재선택을 요구한다.
- `CLOSET_ANALYSIS_PROVIDER=mock` 기반 통과를 실제 옷 인식 성공으로 보고하지 않는다.
- 실제 옷장 AI 초안과 크레딧 차감이 된다고 말하려면 `CLOSET_ANALYSIS_PROVIDER=gemini` 상태에서 `npm run smoke:closet:gemini` 성공 결과를 확인해야 한다.
- 옷장 대량 등록의 AI 추정값은 사용자가 확인하기 전까지 추천 핵심 근거로 쓰지 않는다.
- 옷장 대량 등록을 수정하면 3장 업로드, 1장 수정, 1장 삭제, 1장 저장 E2E와 `/closet/batch`, `/closet/review` visual smoke를 확인해야 한다.
- 배포 버전에서 실제 AI와 크레딧 소모가 시나리오대로 동작한다고 말하려면 `npm run check:deploy:strict`로 real provider/env readiness를 확인해야 한다.
- Vercel production 배포 상태를 말하려면 `npm run check:deploy:vercel` 또는 동등한 Vercel env pull + strict 검증을 먼저 실행해야 한다.
- `npm run check:deploy`에서 mock provider 또는 미구현 provider 경고가 나오면 "배포 UI는 가능하지만 실제 AI/크레딧 기능은 준비되지 않았다"고 보고한다.
- `/api/closet/analyze`는 유료 AI 경로다. 수정 시 크레딧 예약, `Idempotency-Key`, 실패 환불, route 통합 테스트가 유지되는지 확인한다.

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
