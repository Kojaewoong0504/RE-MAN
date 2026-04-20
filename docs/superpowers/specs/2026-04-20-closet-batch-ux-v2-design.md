# Closet Batch UX v2 Design

## Goal

옷장 대량 등록을 30~50개 옷까지 반복 가능한 작업 흐름으로 만든다. 사용자는 사진을 여러 장 추가한 뒤 현재 상태와 다음 행동을 즉시 이해해야 한다.

## Scope

- `/closet/batch`에 상태 요약을 추가한다.
- `/closet/review`에 저장 가능/확인 필요/제외 개수를 추가한다.
- 기존 사진 선택, 카메라 촬영, AI 초안, review 후 저장 구조는 유지한다.
- OCR, 라벨 기반 상품 검색, 실측 추정은 이번 범위에 넣지 않는다.

## UX Contract

- Batch 화면은 `선택됨`, `분석 대기`, `확인 필요`, `제외` 개수를 보여준다.
- 분석 가능한 draft가 있으면 CTA는 `AI 초안 만들기`로 유지한다.
- 분석할 draft가 없고 확인할 draft가 있으면 CTA는 review로 이동하는 행동이 되어야 한다.
- Review 화면은 `저장 가능`, `확인 필요`, `제외` 개수를 보여준다.
- 저장 버튼은 저장 가능한 draft가 없으면 비활성화된다.

## Data Model

기존 `ClosetItemDraft`를 유지한다. 새 저장 필드는 추가하지 않고, `analysis_status`와 `deleted`를 기준으로 요약을 계산한다.

## Verification

- Unit: draft 배열에서 batch/review summary가 정확히 계산된다.
- E2E: 여러 draft 상태가 있을 때 batch 화면과 review 화면이 상태 요약을 표시한다.
- Visual: `/closet/batch`, `/closet/review` 캡처에서 상태 요약이 앱 레이아웃 안에 보인다.
