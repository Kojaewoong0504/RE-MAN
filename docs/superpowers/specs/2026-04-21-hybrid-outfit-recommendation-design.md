# Hybrid Outfit Recommendation Design

## Context

RE:MEN의 현재 결과 화면은 사용자의 `closet_items`와 `closet_strategy`를 기반으로 한 조합만 메인으로 보여준다.
이 구조는 "지금 가진 옷으로 시작"이라는 MVP 원칙에는 맞지만, 아래 상황에서는 추천 품질이 급격히 낮아진다.

- 옷장에 상의/하의/신발은 있지만 실제 선택지가 너무 적은 경우
- `closet_strategy`상 `core`가 거의 없고 `optional` 또는 `use_with_care`가 대부분인 경우
- 현재 스타일 목표와 동기가 분명하지만, 옷장만으로는 방향 제안이 약한 경우

사용자는 "내 옷장으로 가능한 조합"과 "시스템이 추천하는 보강 방향"을 동시에 보고 싶어 한다.
단, MVP에서는 실제 상품 구매 추천까지 바로 확장하지 않고, 공통 스타일 레퍼런스 기반 추천부터 시작해야 한다.

## Goal

스타일 결과에서 아래 두 축을 동시에 제공한다.

1. 사용자의 현재 옷장으로 바로 시도 가능한 조합
2. 서버가 공통 스타일 데이터로 보강한 시스템 추천 조합 또는 보강 아이템 방향

이때 추천은 항상 둘 다 존재할 수 있지만, 옷장 상태에 따라 메인/보조 우선순위가 바뀌어야 한다.

## Non-Goals

- 실제 구매 링크, 가격, 결제 CTA를 MVP 기본 결과에 추가하지 않는다.
- 공통 스타일 라이브러리를 외부 쇼핑몰 카탈로그와 연결하지 않는다.
- 모델이 공통 카탈로그 전체를 직접 고르게 하지 않는다.
- 시스템 추천을 "지금 꼭 사야 하는 상품"처럼 표현하지 않는다.

## User Problem

현재 구조에서는 사용자가 다음 중 하나를 겪는다.

- 옷장이 빈약하면 결과가 약하거나 반복적으로 느껴진다.
- 옷장 조합만 보여줘서 "부족한 부분을 어떤 방향으로 채워야 하는지" 감이 안 온다.
- 시스템 차원의 보완 제안이 없어 결과가 너무 폐쇄적으로 느껴진다.

결과적으로 RE:MEN이 "현재 가능한 조합"만 알려주고, "다음으로 필요한 방향"은 제시하지 못하는 문제가 있다.

## Product Decision

### Primary decision

시스템 추천은 항상 결과에 존재할 수 있다.
단, `recommendation_mix.primary_source`에 따라 메인 카드와 보조 카드의 우선순위를 바꾼다.

### Display rule

- `closet_confidence = high`
  - 메인: 내 옷장 조합
  - 보조: 시스템 추천 스타일
- `closet_confidence = medium`
  - 메인: 내 옷장 조합
  - 보조: 시스템 보강 스타일을 동등한 깊이로 표시
- `closet_confidence = low`
  - 메인: 시스템 추천 스타일
  - 보조: 현재 옷장으로 가능한 범위의 조합

### MVP recommendation mode

MVP에서는 `system_recommendations[].mode = "reference"`만 사용한다.
즉, 시스템 추천은 실제 상품이 아니라 "방향성 있는 공통 아이템"이다.

예:

- 네이비 옥스포드 셔츠
- 차콜 슬랙스
- 화이트 레더 스니커즈

## Architecture

기존 모델 계약을 최대한 유지하고, 서버 후처리 레이어에서 시스템 추천을 합성한다.

### Existing flow

1. `/api/feedback`가 사용자 사진, 설문, 옷장 요약을 에이전트에 전달
2. 모델이 `recommended_outfit` 중심 결과를 반환
3. 서버가 `source_item_ids`를 현재 `closet_items` 기준으로 검증
4. 결과 화면이 검증된 옷장 근거를 표시

### New flow

1. 기존대로 모델에서 `recommended_outfit`를 받는다.
2. 서버가 `closet_items`, `closet_strategy`, `source_item_ids` 검증 결과를 기반으로 옷장 신뢰도를 계산한다.
3. 서버가 공통 `system_style_library`에서 사용자의 목표, 동기, 예산, 회피 방향에 맞는 시스템 추천 후보를 선택한다.
4. 서버가 `recommendation_mix`와 `system_recommendations`를 최종 payload에 합성한다.
5. 결과 UI는 `primary_source`에 따라 메인/보조 블록의 순서를 바꿔서 렌더한다.

## Response Contract

기존 응답에 아래 필드를 추가한다.

```json
{
  "recommended_outfit": {
    "title": "지금 가진 옷으로 만드는 기본 조합",
    "items": ["네이비 셔츠", "검정 슬랙스", "흰색 스니커즈"],
    "reason": "현재 사진과 옷장 기준으로 가장 바로 적용 가능한 조합",
    "try_on_prompt": "..."
  },
  "recommendation_mix": {
    "primary_source": "closet",
    "closet_confidence": "high",
    "system_support_needed": true,
    "missing_categories": ["outerwear"],
    "summary": "주 조합은 옷장 기준, 부족한 겉옷 방향은 시스템 추천으로 보강"
  },
  "system_recommendations": [
    {
      "id": "sys-oxford-navy-001",
      "mode": "reference",
      "category": "tops",
      "title": "네이비 옥스포드 셔츠",
      "color": "네이비",
      "fit": "레귤러",
      "season": ["봄", "가을"],
      "style_tags": ["clean", "date", "office-casual"],
      "reason": "현재 사진의 무게감을 정리하고 슬랙스와 연결하기 쉬움",
      "image_url": "/system-catalog/navy-oxford.jpg",
      "product": null
    }
  ]
}
```

## Data Model

### recommendation_mix

서버 후처리 판단 결과를 담는다.

- `primary_source`: `"closet" | "system"`
- `closet_confidence`: `"high" | "medium" | "low"`
- `system_support_needed`: boolean
- `missing_categories`: `"tops" | "bottoms" | "shoes" | "outerwear"` 배열
- `summary`: 사용자용 짧은 설명

### system_recommendations

공통 스타일 라이브러리 기반 후보 배열이다.

- `id`
- `mode`: MVP에서는 `"reference"`만 허용
- `category`
- `title`
- `color`
- `fit`
- `season`
- `style_tags`
- `reason`
- `image_url`
- `product`

`product`는 미래 확장을 위한 nullable 필드다.
MVP에서는 항상 `null`이어야 한다.

## System Style Library

서버는 `system_style_library`를 별도 데이터 소스로 가진다.

### MVP shape

공통 라이브러리는 실제 판매 상품이 아니라 일반화된 스타일 아이템 집합이다.

각 항목은 최소 아래 정보를 가진다.

- 카테고리
- 대표 이름
- 대표 색상
- 기본 핏
- 계절
- 상황 태그
- 스타일 태그
- 추천 이유 템플릿
- 이미지

### Matching keys

후보 선택 시 아래 입력을 사용한다.

- `survey.current_style`
- `survey.motivation`
- `survey.budget`
- `survey.style_goal`
- `preference_profile.liked_direction`
- `preference_profile.avoid_direction`
- 현재 옷장 부족 카테고리
- 현재 추천 조합의 무드

## Closet Confidence Heuristic

서버는 모델 결과 이후, 규칙 기반으로 옷장 신뢰도를 계산한다.

입력 예시:

- 상의/하의/신발 준비 여부
- `closet_strategy.core_item_ids` 개수
- `use_with_care` 비율
- `optional` 비율
- 검증된 `source_item_ids` 개수
- 추천 조합에 실제로 대응되는 옷장 아이템 수

예상 규칙:

- `high`
  - 필수 카테고리 준비
  - `core` 2개 이상
  - 검증된 source item 충분
- `medium`
  - 필수 카테고리는 있으나 `core`가 적거나 검증 근거가 부족
- `low`
  - 카테고리 부족 또는 주의 아이템 비율이 높아 메인 조합 신뢰도가 낮음

이 규칙은 모델 프롬프트가 아니라 서버 로직으로 관리한다.

## UI Design

결과 화면은 두 블록으로 구성한다.

### Block A

`내 옷장으로 바로 입는 조합`

- 출처 라벨: `내 옷장 기준`
- 검증된 옷장 근거
- 오늘 바로 실행 가능한 조합

### Block B

`시스템이 같이 제안하는 보강 스타일`

- 출처 라벨: `시스템 추천`
- 공통 스타일 레퍼런스 카드
- 부족한 카테고리 또는 보강 방향 설명

### Ordering rule

- `primary_source = closet`
  - Block A 먼저
- `primary_source = system`
  - Block B 먼저

### UI restrictions

- 시스템 추천에 가격 표시 금지
- 시스템 추천에 구매 CTA 금지
- 시스템 추천에 `reference` 배지 표시
- 시스템 추천을 "AI가 고른 실제 상품"처럼 표현 금지

## Copy Rules

- `내 옷장 기준`: 지금 가진 옷으로 바로 시도 가능한 조합
- `시스템 추천`: 부족한 부분을 채울 때 참고할 방향
- `reference`: 스타일 참고용

금지 문구:

- "구매 추천"
- "지금 사야 할 아이템"
- "정답 상품"

## Failure Handling

### When system library lookup fails

- `recommended_outfit`만 보여준다.
- `recommendation_mix.system_support_needed`는 false로 강등한다.
- UI는 시스템 추천 섹션 자체를 그리지 않는다.

### When closet confidence logic fails

- 기본값은 `primary_source = closet`, `closet_confidence = medium`
- 결과는 숨기지 않고 보수적으로 렌더한다.

### When model returns weak closet basis

- 서버가 신뢰도를 낮추고 시스템 추천을 메인으로 올릴 수 있어야 한다.

## Verification

### Unit

- 옷장 상태별 `closet_confidence` 계산 테스트
- `primary_source` 결정 테스트
- `system_recommendations` 선택 로직 테스트
- `mode = reference`일 때 `product`가 항상 null인지 검증

### Integration

- `/api/feedback`가 기존 결과 + `recommendation_mix` + `system_recommendations`를 함께 반환하는지
- 시스템 라이브러리 조회 실패 시 `recommended_outfit`만 반환하는지
- `closet_confidence`와 `primary_source`가 서버 규칙대로 결정되는지

### E2E

- 옷장 충분 상태에서 `내 옷장 기준` 블록이 먼저 보이는지
- 옷장 빈약 상태에서 `시스템 추천` 블록이 먼저 보이는지
- 시스템 추천 카드에 구매 링크/가격이 없는지
- `primary_source`와 실제 메인 블록 순서가 일치하는지

## Harness Rules To Add

- `recommendation_mix.primary_source`와 결과 화면 메인 블록 순서는 항상 일치해야 한다.
- `system_recommendations[].mode = reference`일 때 구매 CTA, 가격, 결제 유도 문구를 노출하면 실패다.
- 시스템 추천은 항상 `시스템 추천` 출처 라벨을 가져야 한다.
- 옷장 추천과 시스템 추천의 근거 라벨이 섞이면 실패다.
- 시스템 라이브러리 조회 실패 시 결과 전체를 실패시키지 않고, 옷장 추천만 유지해야 한다.

## Rollout Strategy

### Phase 1

- `system_style_library` 정적 seed
- `recommendation_mix` + `system_recommendations` 응답 추가
- 결과 화면 2블록 구성

### Phase 2

- 공통 추천 이미지 품질 개선
- 상황/계절/예산 태그 고도화
- 시스템 추천과 사용자 반응 연결

### Phase 3

- 실제 상품 카탈로그 연결
- `product` 필드 활성화
- 가격/사이즈/링크 연동

단, Phase 3 이전에는 기본 결과 흐름에서 상품 추천처럼 보이지 않게 유지한다.
