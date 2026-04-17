# Basis UI Harness Plan

## Scope

추천 근거 UI label 규칙을 MVP 하네스에 추가한다.

## Steps

1. 하네스 출력에 `PASS basis-ui-labels`가 필요하다는 단위 테스트를 추가하고 실패를 확인한다.
2. `harness/mvp/run.py`에 basis UI 문서/source 검사를 추가한다.
3. 화면 render 파일에서 legacy label과 내부 score 노출을 금지한다.
4. docs index에 작업 문서를 연결한다.
5. 단위 테스트와 하네스, 정적 검증을 실행한다.

## Non-Goals

- 추천 알고리즘 변경
- 결과 화면 UI 재배치
- Gemini provider 계약 변경
