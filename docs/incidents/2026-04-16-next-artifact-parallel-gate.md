# Incident: Next artifact gate parallel execution

## Symptom

`npm run test:e2e`와 `npm run build`를 동시에 실행해 `next build`가 `PageNotFoundError: /_document`로 실패했다.

## Root Cause

이미 `docs/engineering/save-gate.md`에 병렬 실행 금지 규칙이 있었지만, 에이전트가 `multi_tool`로 Playwright webServer와 `next build`를 동시에 실행했다.
두 명령이 같은 `.next` 산출물을 동시에 사용하면서 거짓 실패가 발생했다.

## Fix

- `scripts/with-next-artifact-lock.py`를 추가해 Next 산출물과 브라우저 서버를 쓰는 검증의 동시 실행을 차단했다.
- `package.json`의 `build`, `test:e2e`, `visual:app`, `visual:deep-dive`가 모두 lock wrapper를 거치게 했다.
- `AGENTS.md`와 `docs/engineering/save-gate.md`에 병렬 실행 금지와 lock 실패 처리 규칙을 추가했다.

## Prevent Recurrence

- 에이전트는 `npm run build`, `npm run test:e2e`, `npm run visual:app`, `npm run visual:deep-dive`를 `multi_tool`로 동시에 실행하지 않는다.
- 실수로 동시에 실행하면 lock wrapper가 두 번째 명령을 실패시킨다.
- 이 실패는 앱 기능 실패가 아니라 하네스 실행 위반으로 보고하고, 순차 실행으로 재검증한다.

## Verification

- lock 동시 실행 차단 확인
- `npm run build` 단독 통과
- `npm run test:e2e -- --project=chromium tests/e2e/onboarding.spec.ts` 순차 실행 통과
