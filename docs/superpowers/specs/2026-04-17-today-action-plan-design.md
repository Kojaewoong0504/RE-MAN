# Today Action Plan Design

## Goal

결과 화면의 `오늘 할 일`을 사용자가 바로 따라 할 수 있는 3단계 실행 카드로 바꾼다.

## Problem

현재 `today_action`은 문장 하나로 보여진다. 문장만 있으면 사용자가 무엇을 먼저 해야 하는지 스캔하기 어렵고, 결과 화면이 실제 행동으로 이어지는 힘이 약하다.

## Decisions

- Gemini/mock provider 계약은 바꾸지 않는다.
- 기존 `today_action` 문장은 기준 문장으로 유지한다.
- 클라이언트 helper가 추천 조합 3개 아이템과 `today_action`을 받아 3단계 실행 카드로 변환한다.
- 단계는 저장 상태 없이 화면에서만 보여준다.
- 완료 체크 저장은 다음 단계로 미룬다.

## Action Steps

1. 추천 상의 꺼내기
2. 하의와 신발 같이 입기
3. 거울 앞에서 사진 비교하기

## Acceptance Criteria

- 결과 화면에 `오늘 실행 3단계`가 보인다.
- 기존 `today_action` 문장이 사라지지 않는다.
- 추천 조합의 상의/하의/신발이 단계 설명에 포함된다.
- provider 응답 JSON 계약은 변경하지 않는다.
- E2E와 visual smoke로 결과 화면 배치를 확인한다.
