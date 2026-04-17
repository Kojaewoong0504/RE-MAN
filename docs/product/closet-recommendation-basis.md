# Closet Recommendation Basis

## Purpose

추천 결과는 "옷장 기반"이라고 말하려면 사용자가 등록한 어떤 아이템을 근거로 삼았는지 보여줘야 한다.
MVP v0에서는 모델이 `source_item_ids`를 반환할 수 있으면 그 값을 우선 사용한다.
단, 이 값은 현재 요청의 `closet_items`에 같은 id와 같은 카테고리로 존재할 때만 검증된 근거로 인정한다.
값이 없거나 기존 저장 결과라면 결과 화면에서 추천 조합 텍스트와 등록 아이템을 보수적으로 매칭한다.

옷장 아이템의 원본은 사진이다.
다만 현재 추천 매칭은 사진 픽셀을 직접 읽지 않고, 사용자가 사진에 붙인 카테고리/이름/색/메모 요약을 기준으로 한다.

## Matching Rule

1. `recommended_outfit.source_item_ids`에 카테고리별 id가 있으면 현재 `closet_items`의 같은 카테고리 id와 대조한다.
2. 검증된 id만 직접 매칭으로 표시한다. 존재하지 않는 id, 다른 카테고리 id, 빈 id는 제거한다.
3. 검증된 `source_item_ids`가 없으면 추천 조합의 상의, 하의, 신발 텍스트를 각각 같은 카테고리의 옷장 아이템과 비교한다.
4. 아이템 이름 또는 색상이 추천 텍스트에 포함되면 matched 상태로 표시한다.
5. 정확히 매칭되지 않으면 해당 카테고리의 첫 번째 등록 아이템을 fallback basis로 표시한다.
6. 겉옷은 추천 조합에 직접 포함되지 않을 수 있으므로 등록되어 있어도 "추가 후보"로 표시한다.

## Display Rule

각 근거 항목은 아래 정보를 보여준다.

- 카테고리
- 옷장 사진 미리보기
- 아이템 이름
- 매칭 상태: `추천에 사용` / `비슷한 후보` / `추가 후보`
- 옷장 신호: `자주 입고 잘 맞음` / `핏/상태 확인` / `후보`
- 사이즈와 착용감이 있으면 짧게 함께 표시

`closet_strategy.items[].score` 같은 내부 점수는 UI에 노출하지 않는다.
결과 화면과 기록 화면은 같은 표시 label을 사용해야 한다.

## Smoke Verification

- `npm run smoke:feedback:gemini`는 등록된 옷장 아이템 3개를 `/api/feedback`에 보내고, 응답의 `recommended_outfit.source_item_ids`가 같은 id를 반환하는지 검사한다.
- 이 검증은 `AI_PROVIDER=gemini`로 실행된 로컬 서버에서 통과해야 실제 Gemini가 옷장 근거 id를 안정적으로 반환한다고 말할 수 있다.
- `AI_PROVIDER=mock`으로 통과한 결과는 smoke 스크립트와 mock 계약 검증일 뿐, 실제 Gemini 검증으로 보고하지 않는다.
- `/api/feedback`은 provider가 반환한 `source_item_ids`를 현재 요청의 `closet_items`로 다시 검증해야 한다.

## Non-Negotiables

- 매칭 결과를 "AI가 정확히 이 상품을 골랐다"고 표현하지 않는다.
- 옷장 사진을 AI가 직접 판독했다고 표현하지 않는다.
- 상품 판정, 구매 추천, 가격 추천으로 보이게 만들지 않는다.
- `source_item_ids`가 없는 과거 결과는 "비슷한 후보"로만 표현한다.
- 검증되지 않은 `source_item_ids`를 직접 매칭으로 표현하지 않는다.
