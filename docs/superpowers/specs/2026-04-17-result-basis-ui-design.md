# Result Basis UI Design

## Goal

추천 결과 화면과 기록 화면에서 "이 옷장에서 고른 이유"를 짧고 확인 가능한 문구로 보여준다.

## User Problem

추천 근거가 원시 상태값이나 긴 설명으로 보이면 사용자는 어떤 옷이 실제 추천에 쓰였는지 빠르게 이해하기 어렵다. 특히 점수나 내부 역할을 그대로 노출하면 서비스가 덜 완성된 것처럼 보인다.

## Decisions

- 추천에 직접 연결된 옷은 `추천에 사용`으로 표시한다.
- 직접 연결은 아니지만 같은 카테고리에서 가장 가까운 옷은 `비슷한 후보`로 표시한다.
- 겉옷처럼 선택적으로 더할 수 있는 옷은 `추가 후보`로 표시한다.
- 옷장 전략의 내부 점수는 UI에 노출하지 않는다.
- 전략 역할은 짧은 사용자 문구로 변환한다.
- 결과 화면과 기록 화면은 같은 basis 모델을 사용한다.

## Labels

| Internal | User-facing |
|---|---|
| `matched` | 추천에 사용 |
| `fallback` | 비슷한 후보 |
| `optional` | 추가 후보 |
| `core` | 자주 입고 잘 맞음 |
| `use_with_care` | 핏/상태 확인 |
| `optional` | 후보 |

## Acceptance Criteria

- `buildClosetBasisMatches`가 status label, signal label, detail label을 반환한다.
- 결과 화면의 basis card가 새 label을 표시한다.
- 기록 화면의 expanded card가 같은 label을 표시한다.
- 단위 테스트가 source item, fallback, strategy role label을 검증한다.
- E2E 또는 visual 검증으로 결과 화면에서 label이 실제 보이는지 확인한다.
