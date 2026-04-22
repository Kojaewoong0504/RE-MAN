# Selective Try-On And Expanded Style Categories Design

## Why

RE:MAN의 현재 결과 화면은 추천 조합을 하나로 고정해서 보여주고, 실착도 그 전체 조합을 그대로 생성하는 흐름에 가깝다. 이 구조는 두 가지 한계가 있다.

1. 사용자가 추천된 아이템 중 일부만 골라 실착해 보고 싶어도 선택권이 없다.
2. 추천 카테고리가 상의, 하의, 신발, 외투 중심에 머물러 있어 모자, 가방 같은 스타일 보정 요소를 다루기 어렵다.

이번 설계의 1차 목적은 다음 세 가지다.

- 시스템 추천을 "한 벌 추천"이 아니라 "선택 가능한 추천 후보군"으로 확장한다.
- 사용자가 추천 후보 중 원하는 아이템만 골라 실착할 수 있게 한다.
- 선택된 아이템은 자동 정렬을 기본으로 하되, 필요할 때 제한된 수동 순서 조정도 허용한다.

이 설계는 바로 모든 추천 품질 문제를 해결하려는 것이 아니다. 먼저 추천 구조와 실착 선택 구조를 바꿔서, 이후 추천 랭킹 품질을 올릴 수 있는 기반을 만든다.

## Goals

- 결과 화면에서 시스템 추천을 카드 단위로 선택할 수 있어야 한다.
- 실착은 추천 전체 강제가 아니라 사용자가 선택한 아이템 집합을 기준으로 생성해야 한다.
- 상의 레이어링을 고려할 수 있도록 `base_top`, `mid_top`, `outerwear` 역할 분리를 도입한다.
- 모자와 가방까지 1차 카테고리 확장을 지원한다.
- 자동 정렬을 기본으로 하면서, 사용자가 원하면 수동 순서 조정으로 보정할 수 있어야 한다.
- 실착 과금 정책은 provider 내부 pass 수가 아니라 사용자 선택 아이템 수 기준으로 유지한다.

## Non-Goals

- 액세서리 전체 확장(시계, 목걸이, 벨트, 안경 등)은 1차 범위에서 제외한다.
- 추천 카드에 구매 CTA, 가격, 재고, 링크를 붙이지 않는다.
- 실착 품질 자체를 이번 단계에서 완전히 해결한다고 주장하지 않는다.
- 사용자가 옷장 카테고리 구조를 전면 재구성하는 기능은 이번 단계에 넣지 않는다.

## User Experience

### Result Screen Layout

결과 화면은 세 개의 주요 블록으로 재구성한다.

1. `기본 추천 조합`
   현재 AI가 가장 먼저 권하는 조합 1개를 보여준다.
2. `선택 가능한 추천 카드`
   사용자가 실착 대상으로 직접 선택할 수 있는 카드 후보군을 보여준다.
3. `선택 실착 패널`
   현재 선택 상태, 자동 정렬 결과, 경고, 예상 크레딧, 생성 CTA를 보여준다.

이 구조의 목적은 "추천 보기"와 "실착 만들기"를 명확히 분리하는 것이다. 사용자는 먼저 AI의 기본 추천을 이해하고, 그 다음 자신이 원하는 조합으로 조정할 수 있어야 한다.

### Selective Try-On Flow

1. 사용자는 시스템 추천 카드 중 원하는 아이템을 자유롭게 선택한다.
2. 시스템은 선택 결과를 보고 자동으로 레이어 순서를 만든다.
3. 선택 실착 패널에 현재 조합과 예상 크레딧을 보여준다.
4. 기본은 자동 정렬 상태다.
5. 사용자가 `레이어 수정`을 열면 순서를 수동으로 보정할 수 있다.
6. 조합이 유효하면 `선택 실착 만들기`를 눌러 생성한다.

### Auto Order And Manual Override

- 기본값은 자동 정렬이다.
- 자동 정렬은 사용자가 패션에 익숙하지 않아도 안정적인 순서를 제공해야 한다.
- 수동 조정은 선택된 아이템의 순서를 미세 조정하는 용도다.
- 단, 수동 조정도 완전 자유가 아니라 레이어 규칙 안에서만 허용한다.
- `자동 정렬로 복원` 버튼을 제공한다.

## Category And Role Model

### 1st-Phase Categories

1차 구현에서 시스템 추천과 실착 선택에 노출할 카테고리는 아래와 같다.

- `tops`
- `bottoms`
- `shoes`
- `outerwear`
- `hats`
- `bags`

`accessories`는 다음 단계로 미룬다. 이유는 반영 품질 검증 기준과 선택 규칙이 더 복잡하기 때문이다.

### Layer Roles

카테고리만으로는 실착 순서를 다룰 수 없으므로 role을 별도로 둔다.

- `base_top`
- `mid_top`
- `outerwear`
- `bottom`
- `shoes`
- `addon`

역할은 사용자에게 직접 강요하는 개념이 아니라 시스템 내부 정렬과 validation에 사용한다.

예시:

- 셔츠, 티셔츠: `base_top`
- 니트, 가디건, 후드: `mid_top`
- 자켓, 코트, 블루종: `outerwear`
- 바지: `bottom`
- 신발: `shoes`
- 모자, 가방: `addon`

## Recommendation Data Contract

### Current Limitation

현재 `recommended_outfit.items` 중심 계약은 "문자열 3개" 수준이라 선택형 실착을 지원하기 어렵다.

### New Output Structure

추천 응답은 두 층으로 나눈다.

- `primary_outfit`
  AI가 가장 먼저 권하는 기본 조합
- `selectable_recommendations`
  사용자가 카드 단위로 선택할 수 있는 후보 목록

예시:

```json
{
  "primary_outfit": {
    "title": "편안함에 스타일 한 스푼",
    "item_ids": ["top-1", "mid-1", "bottom-2", "shoes-1"],
    "reason": "지금 체형과 현재 스타일에서 가장 무난하게 개선 폭이 큼"
  },
  "selectable_recommendations": [
    {
      "id": "top-1",
      "category": "tops",
      "role": "base_top",
      "title": "화이트 에센셜 티셔츠",
      "reason": "얼굴 주변이 답답하지 않고 대부분의 하의와 연결 쉬움",
      "image_url": "/system-catalog/tops/white-essential-tee.png",
      "compatibility_tags": ["clean", "casual"],
      "layer_order_default": 10
    }
  ]
}
```

### Recommendation Generation

시스템 추천은 단순 카탈로그 나열이 아니라 아래 입력 신호를 반영한 정렬 결과여야 한다.

- 현재 전신 사진 분석 결과
- 설문
- 옷장 아이템과 전략
- 과거 반응
- 목적 맥락
- 선호/회피 방향
- 체형/핏 힌트

출력 단계는 다음과 같다.

1. 후보 카드 풀 생성
2. 후보별 적합도 점수 계산
3. role별 우선순위 정렬
4. `primary_outfit` 조합 구성
5. 나머지 후보를 `selectable_recommendations`로 노출

### Balanced Recommendation Rule

시스템 추천은 상의 카드만 여러 장 반복하는 식으로 끝나면 실패다. 기본 추천과 선택 카드 모두 최소한 "조합"을 만들 수 있는 균형을 가져야 한다.

- `primary_outfit`은 가능한 경우 `base_top`, `bottom`, `shoes`를 우선 포함한다.
- `outerwear`, `hats`, `bags`는 보정 요소로 추가한다.
- `selectable_recommendations`도 첫 노출 구간에서 상의 후보만 몰리지 않도록 role 분산이 필요하다.
- 특정 role 후보가 부족하면 그 사실을 내부적으로 기록하되, UI에는 단순히 상의 카드만 반복 노출하지 않는다. 대신 조합 후보 부족 상태를 짧게 알리는 fallback 표현을 둔다.

1차 기준으로는 최소 다음 조건을 만족해야 한다.

- 화면 상단 추천 세트는 조합 가능한 기본 축을 갖춰야 한다.
- 선택 카드의 초기 노출 세트에는 `base_top`, `bottom`, `shoes` 중 최소 2개 이상이 포함돼야 한다.
- `outerwear`, `hats`, `bags`는 보조 후보로 뒤에 붙되, 기본 조합 축을 밀어내지 않는다.

## Selection State Model

결과 화면에서 사용자가 선택한 실착 세트는 별도 상태로 유지한다.

```json
{
  "selected_item_ids": ["top-1", "outer-1", "bottom-1", "shoes-1"],
  "manual_order_enabled": false,
  "ordered_item_ids": ["top-1", "outer-1", "bottom-1", "shoes-1"],
  "validation_state": "valid",
  "warnings": []
}
```

핵심 원칙:

- 자동 정렬일 때는 `selected_item_ids`만으로 계산 가능해야 한다.
- 수동 조정에 들어가면 `ordered_item_ids`를 따로 저장한다.
- 서버 전송 전 validation을 한 번 더 거친다.

## Validation Rules

실착 선택 UX는 자유 선택처럼 보이지만 내부적으로는 규칙 엔진이 막아야 한다.

1. `bottom`은 1개만 허용
2. `shoes`는 1개만 허용
3. `base_top`은 기본 1개, 추후 2개 확장 여지는 두되 1차는 1개 권장
4. `mid_top`은 1차에서는 1개 권장
5. `outerwear`는 1개 권장
6. `addon`은 여러 개 허용
7. 자동 정렬 기본 순서는 `base_top -> mid_top -> outerwear -> bottom -> shoes -> addon`
8. 수동 정렬은 허용하지만 role 경계를 깨는 순서는 차단

수동 조정의 의미는 "완전 자유 순열"이 아니라 "허용된 레이어 범위 안에서의 보정"이다.

- `base_top`보다 바깥에 와야 하는 `mid_top`, `outerwear`를 안쪽으로 넣을 수 없다.
- `bottom`, `shoes`는 상의 레이어 그룹 안으로 이동할 수 없다.
- `addon`은 기본적으로 마지막 그룹이지만, UI 표현 순서는 바뀔 수 있어도 provider 입력 순서는 role 규칙을 다시 따른다.
- 사용자가 수동 조정 후에도 최종 provider payload는 validation을 다시 거친 canonical order로 정규화한다.

예시:

- 허용: 셔츠 + 니트 + 자켓 + 바지 + 신발 + 가방
- 차단: 바지 2개, 신발 2개
- 경고 또는 차단: `outerwear`를 `base_top`보다 안쪽으로 넣는 순서

## Try-On API Contract

### New Request Shape

`/api/try-on`은 더 이상 단순 `product_images`만 전달받는 경로로 고정하지 않는다. 선택 세트를 명시적으로 받는다.

```json
{
  "person_image": "<data-url>",
  "selected_items": [
    {
      "id": "top-1",
      "category": "tops",
      "role": "base_top",
      "title": "화이트 에센셜 티셔츠",
      "image_url": "<resolved image>"
    },
    {
      "id": "outer-1",
      "category": "outerwear",
      "role": "outerwear",
      "title": "네이비 블루종",
      "image_url": "<resolved image>"
    }
  ],
  "manual_order_enabled": false,
  "ordered_item_ids": ["top-1", "outer-1"],
  "prompt": "..."
}
```

### Internal Provider Strategy

provider 호출 직전에는 아래 순서로 처리한다.

1. 사용자 선택과 role 기반 validation
2. 자동 정렬 또는 수동 순서 적용
3. 이미지 리스트 생성
4. **Vertex direct path**: 최대 3개까지 직접 요청 시도
5. direct path가 `Invalid number of product images`로 실패하면
6. **Layered fallback path**: 1개씩 순차 체이닝

이 구조를 택하는 이유:

- 공식 계약은 최대 3개 direct를 허용한다.
- 하지만 현재 우리 런타임은 환경에 따라 direct 다건 요청을 거부할 수 있다.
- 따라서 direct를 먼저 시도하고, 실패 시 `fitreco`와 같은 layered fallback으로 내려가는 것이 가장 안전하다.

## Credit Policy

과금은 provider 내부 pass 수와 직접 연결하지 않는다. 사용자에게 보여주는 정책은 실착 선택 아이템 수 기준으로 유지한다.

- `1~3개 = 1크레딧`
- `4~6개 = 2크레딧`
- `7개 이상 = 3크레딧+`

예:

- 셔츠 + 바지 + 신발 = 1크레딧
- 셔츠 + 니트 + 자켓 + 바지 + 신발 = 2크레딧

route 응답과 UI 문구는 이 정책으로 일관돼야 한다.

## Result Screen Components

### Primary Outfit Block

- 가장 추천하는 기본 조합 1개
- 제목, 이유, 핵심 아이템 요약

### Selectable Recommendation Grid

- 카드 단위 선택 UI
- category와 role을 직접 노출하기보다 사람이 이해할 수 있는 짧은 설명을 사용
- 예: `베이스 상의`, `중간 레이어`, `겉옷`, `하의`, `신발`, `가방`

### Try-On Selection Panel

- 현재 선택된 카드 요약
- 자동 정렬 결과
- 예상 크레딧
- 경고/차단 상태
- `레이어 수정`
- `선택 실착 만들기`

### Layer Editor

- 기본은 숨김
- 사용자가 원할 때 열 수 있음
- 선택된 카드 목록을 순서대로 보여줌
- `위로`, `아래로` 또는 drag handle
- 불가능한 순서는 즉시 차단
- `자동 정렬로 복원` 버튼 제공

## Testing Strategy

### Unit Tests

- role/order validation
- 자동 정렬 알고리즘
- 수동 정렬 제한
- 크레딧 계산
- category 확장 시 규칙 적용
- direct path와 layered fallback 분기

### Integration Tests

- `/api/feedback`가 `primary_outfit`과 `selectable_recommendations`를 올바르게 반환하는지
- `/api/try-on`이 `selected_items`와 `ordered_item_ids`를 받아 내부 변환하는지
- direct up to 3 시도 후 필요한 경우 fallback으로 내려가는지
- 과금 정책이 `3개당 1크레딧`으로 고정되는지

### E2E Tests

- 사용자가 카드 선택
- 자동 정렬 결과 확인
- 수동 순서 변경
- 예상 크레딧 표시 확인
- 실착 생성
- 결과 이미지 보기

## Rollout Plan

### Phase 1

- 카테고리 확장: `outerwear`, `hats`, `bags`
- 추천 구조 확장: `primary_outfit`, `selectable_recommendations`
- 결과 화면 선택 UI
- 자동 정렬
- 제한된 수동 순서 조정
- try-on direct up to 3 + fallback
- `3개당 1크레딧` 정책 고정

### Phase 2

- 액세서리 확장
- 추천 품질 랭킹 고도화
- 선택 실착 결과 평가 및 자동 재시도 조건 추가

## Risks

### Recommendation Density

추천 카드가 너무 많아지면 사용자가 고르기 어려워진다. 1차에서는 role별로 제한된 수의 상위 후보만 노출해야 한다.

### Try-On Quality

direct 경로와 fallback 경로가 모두 성공하더라도, 실제 품질은 role 조합과 prompt 품질에 따라 달라질 수 있다. 이번 단계는 계약과 경로를 정리하는 것이지, 결과 품질을 완전히 보장하는 단계는 아니다.

### Category Drift

카테고리만 늘리고 추천 이유와 validation이 약하면 "상의만 과도하게 추천"하는 현상이 반복될 수 있다. role 기반 정렬과 테스트가 반드시 필요하다.

## Decision Summary

- 중심축은 `선택 실착 UX`
- 추천은 `primary_outfit + selectable_recommendations` 구조로 확장
- 사용자는 카드 단위 자유 선택
- 내부는 `role + order + validation`
- 자동 정렬 기본, 수동 보정 허용
- 1차 카테고리는 `outerwear`, `hats`, `bags`
- `try-on`은 direct up to 3 시도 후 실패 시 layered fallback
- 과금은 `최대 3개당 1크레딧`

## Acceptance Criteria

- 결과 화면은 `기본 추천 조합`, `선택 가능한 추천 카드`, `선택 실착 패널`의 세 블록을 분리해 보여준다.
- 시스템 추천은 상의 카드만 반복하지 않고, 가능한 경우 조합 가능한 role 분산을 갖춘다.
- 사용자는 시스템 추천 전체 강제가 아니라 카드 단위로 선택해 실착을 요청할 수 있다.
- 자동 정렬이 기본이며, 사용자가 원하면 제한된 수동 순서 보정을 할 수 있다.
- `/api/try-on`은 선택 아이템 집합과 순서 정보를 명시적으로 받는다.
- provider 경로는 direct 최대 3개 시도 후, 다건 거부 시 layered fallback으로 내려간다.
- 사용자 과금은 provider 내부 pass 수가 아니라 `최대 3개당 1크레딧` 정책으로 유지된다.
- 1차 범위에서 `outerwear`, `hats`, `bags`를 추천/선택/실착 계약에 포함할 수 있다.
