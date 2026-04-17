# Result Basis UI Plan

## Scope

추천 결과 근거 UI의 표시 문구와 데이터 모델을 정리한다. 추천 알고리즘 자체는 변경하지 않는다.

## Steps

1. 단위 테스트에 basis 표시 label 기대값을 추가하고 실패를 확인한다.
2. `buildClosetBasisMatches`에 strategy item 입력과 사용자 표시 label을 추가한다.
3. 결과 화면에서 `buildClosetStrategy` 기반 basis label을 표시한다.
4. 기록 화면에서 같은 basis label을 표시한다.
5. 제품 문서와 docs index를 업데이트한다.
6. 단위 테스트, E2E, visual, build, harness를 순서대로 검증한다.

## Non-Goals

- Gemini 추천 프롬프트 변경
- 크레딧/결제 로직 변경
- 새 화면 추가
