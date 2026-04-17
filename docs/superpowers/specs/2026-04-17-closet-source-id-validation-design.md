# Closet Source ID Validation Design

## Purpose

추천 결과의 `recommended_outfit.source_item_ids`는 사용자의 실제 옷장 아이템을 가리킬 때만 `직접 매칭` 근거로 취급한다.
모델이 존재하지 않는 id, 다른 카테고리의 id, 빈 id를 반환하면 앱은 이를 신뢰하지 않고 제거한다.

## Scope

- `/api/feedback` 응답 직후 source id를 요청 payload의 `closet_items`로 검증한다.
- 검증된 id만 클라이언트에 반환한다.
- 제거된 id는 오류로 처리하지 않는다. 과거 결과와 동일하게 결과 화면의 보수적 매칭 규칙이 `근거 후보`를 보여준다.
- `source_item_ids` 검증은 mock, Gemini provider 모두에 동일하게 적용한다.

## Non-Goals

- 옷장 사진 자동 판독은 하지 않는다.
- Gemini 프롬프트를 크게 변경하지 않는다.
- 추천 조합 자체를 서버에서 재작성하지 않는다.
- 상품 추천이나 구매 링크와 연결하지 않는다.

## Rules

- `source_item_ids.tops`는 `closet_items` 안에 `category: "tops"`인 같은 id가 있을 때만 유지한다.
- `bottoms`, `shoes`, `outerwear`도 동일한 카테고리 검증을 통과해야 한다.
- 빈 문자열, 공백 문자열, 알 수 없는 카테고리, 존재하지 않는 id는 제거한다.
- 모든 id가 제거되면 `source_item_ids`는 `undefined`로 정규화한다.

## Verification

- 단위 테스트는 source id 정제 함수를 직접 검증한다.
- 통합 테스트는 `/api/feedback`이 provider의 잘못된 source id를 그대로 반환하지 않는지 검증한다.
- E2E는 결과 화면이 검증된 id만 `직접 매칭`으로 표시하고, 잘못된 id는 `근거 후보`로 낮추는지 검증한다.
