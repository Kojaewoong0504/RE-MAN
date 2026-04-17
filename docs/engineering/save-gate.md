# save-gate.md

## Purpose

이 문서는 저장소의 save gate를 정의한다.
목표는 사람이 부탁해서 품질을 맞추는 것이 아니라, 기준을 통과하지 못하면 다음 단계로 진행되지 못하게 하는 것이다.

## Principle

성공은 조용히 지나가고, 실패만 시끄럽게 보여야 한다.

- 통과 로그를 길게 출력하지 않는다.
- 실패 시에만 짧고 구조화된 메시지를 출력한다.
- 실패한 변경은 커밋이나 푸시로 넘어갈 수 없다.

## Gate Levels

### Level 1. Save-Time

가장 이상적인 형태는 저장 시 즉시 검사다.
다만 이 단계는 에디터와 로컬 환경에 종속적이므로 저장소 차원에서 완전 강제하기 어렵다.

따라서 현재 저장소의 공식 강제점은 아래 두 단계다.

### Level 2. Pre-Commit

커밋 전에 반드시 아래를 통과해야 한다.

1. repository harness
2. application harness
3. content rules
4. 타입 체크
5. 린트
6. 단위 테스트

이 단계는 저장소 구조와 에이전트 계약이 깨졌는지 빠르게 확인하는 최소 게이트다.
또한 e2e만으로 품질을 대표하지 않도록, 가능한 범위의 단위/통합 테스트도 이 단계 또는 CI 단계에 포함해야 한다.

### Level 3. Pre-Push

푸시 전에는 pre-commit보다 더 무거운 검사를 둘 수 있다.

- 타입 체크
- 린트
- 단위 테스트
- 통합 테스트
- build
- garbage collection 검사
- e2e 테스트

현재 앱 코드가 있으므로 이 단계는 pre-push와 CI에서 실행 가능한 필수 검증으로 유지한다.

## Failure Output

실패 출력은 아래 원칙을 따른다.

1. 어떤 게이트가 실패했는지 보인다
2. 왜 실패했는지 한 줄씩 보인다
3. 성공 항목은 요약만 한다
4. 불필요한 장문 로그는 출력하지 않는다

## Current v0 Behavior

현재 save gate v0는 아래만 강제한다.

1. `python3 harness/repository/run.py`
2. `python3 harness/application/run.py`
3. `python3 harness/application/content_rules.py`
4. `npm run typecheck`
5. `npm run lint`
6. `npm run test:unit`

pre-push에서는 여기에 아래가 추가된다.

7. `npm run test:integration`
8. `python3 harness/gc/run.py`
9. `npm run test:e2e -- --project=chromium tests/e2e/onboarding.spec.ts`
10. `npm run visual:deep-dive`
11. `npm run build`

하나라도 실패하면 gate는 실패다.

## Execution Rule

- `npm run test:e2e`와 `npm run build`는 병렬 실행하지 않는다.
- 둘 다 `.next` 산출물을 사용하므로 병렬 실행 시 `PageNotFoundError: /_document` 같은 거짓 실패가 발생할 수 있다.
- 이 경우 코드 실패로 보고하지 말고, 실행 방식을 수정한 뒤 build를 단독으로 재실행한다.
- `npm run build`, `npm run test:e2e`, `npm run visual:app`, `npm run visual:deep-dive`는 `scripts/with-next-artifact-lock.py`를 통해 같은 저장소에서 동시 실행을 차단한다.
- 에이전트가 `multi_tool` 또는 백그라운드 세션으로 위 명령들을 병렬 실행해 lock 실패가 발생하면, 이는 앱 실패가 아니라 하네스 실행 위반이다. lock 실패를 숨기지 말고 순차 실행으로 재검증한다.

## Provider Smoke Rule

기본 gate는 비용과 외부 장애 가능성 때문에 실제 Gemini 호출을 자동 실행하지 않는다.
따라서 아래를 엄격히 구분한다.

- `npm run test:e2e`: `AI_PROVIDER=mock` 기반 사용자 흐름 검증
- `npm run smoke:feedback:gemini`: 로컬 서버의 실제 Gemini 사진 분석 smoke 검증. 등록된 옷장 아이템을 보낸 경우 `recommended_outfit.source_item_ids`가 해당 id를 반환해야 한다.
- `npm run smoke:feedback:browser`: 실제 브라우저 업로드 경로에서 Gemini 사진 분석 smoke 검증

에이전트는 실제 Gemini 사진 분석이 된다고 보고하기 전에 반드시 아래 조건을 만족해야 한다.

1. `npm run dev`가 3001 포트에서 실행 중이어야 한다.
2. `.env.local`에 `AI_PROVIDER=gemini`, `GOOGLE_API_KEY`, `GEMINI_REQUEST_TIMEOUT_MS=30000`, `GEMINI_MAX_RETRIES=0`이 있어야 한다.
3. `npm run smoke:feedback:gemini`가 200 응답, 필수 필드, `recommended_outfit.source_item_ids`를 확인해야 한다.
4. "브라우저 업로드 플로우가 된다"고 보고하려면 `npm run smoke:feedback:browser`도 200 응답을 확인해야 한다.

이 smoke를 실행하지 않은 경우 최종 보고에서 "실제 Gemini smoke 미실행"이라고 명시한다.

## Visual Evidence Rule

UI/UX 변경은 테스트 통과만으로 완료 보고하지 않는다.
핵심 경로가 화면에서 어떻게 보이는지 브라우저 스크린샷 또는 trace 산출물로 남긴다.

- deep-dive 결과 화면 변경 시 `npm run visual:deep-dive`를 실행한다.
- 홈, 스타일 시작, 업로드, 분석 오류, 결과, 옷장, 기록, 기록 상세, 내 정보, 설정처럼 주요 화면 배치가 바뀌면 `npm run visual:app`을 실행한다.
- `visual:app` 산출물은 `output/playwright/app-visual-smoke/`에 저장한다.
- `visual:deep-dive` 산출물은 `output/playwright/result-minimal/`에 저장한다.
- 이 smoke는 desktop, mobile viewport를 모두 캡처하고 개발자용 provider 라벨이 사용자 화면에 노출되지 않는지 확인한다.
- `output/`은 git에 포함하지 않고, 완료 보고에는 산출물 경로를 명시한다.
- 이 검증을 실행하지 못한 경우 최종 보고에서 "시각 검증 미실행"이라고 명시한다.
- `npm run visual:app`, `npm run visual:deep-dive`, Playwright E2E처럼 3001 포트의 브라우저 서버를 쓰는 검증은 병렬 실행하지 않는다. 포트 충돌은 기능 실패가 아니라 하네스 실행 순서 실패로 분리 보고한다.

## CI Rule

GitHub Actions의 required check는 로컬 pre-push gate와 같은 `python3 scripts/run-save-gate.py pre-push`를 실행한다.
CI에서 별도 e2e job을 중복으로 두지 않는다.

- `harness/reports`는 항상 artifact로 업로드한다.
- `output/playwright/app-visual-smoke`와 `output/playwright/result-minimal`은 항상 visual evidence artifact로 업로드한다.
- Playwright failure artifact는 실패 시에만 업로드한다.

## Future v1

앱 코드가 더 커지면 아래를 pre-push 또는 CI gate로 확장한다.

1. 단위 테스트
2. 통합 테스트
3. dead code 탐지 고도화
4. garbage collection 검사 고도화
5. self-repair orchestration 연결
