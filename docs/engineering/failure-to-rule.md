# failure-to-rule.md

## Purpose

이 문서는 실패를 단순 수정으로 끝내지 않고, 규칙과 하네스로 승격하는 절차를 정의한다.

## Principle

같은 실수가 다시 발생할 수 있다면, 아직 해결된 것이 아니다.

실패 대응의 끝은 코드 수정이 아니라 구조 변경이어야 한다.

## Flow

### 1. Failure Capture

실패가 발생하면 먼저 실패를 분류한다.

- 문서 불일치
- 출력 계약 위반
- 타입/문법 오류
- 안전성 위반
- 반복된 패턴 오염

### 2. Local Fix

즉시 깨진 부분은 고친다.
하지만 여기서 종료하지 않는다.

### 3. Recurrence Check

이 실패가 다시 발생할 수 있는지 판단한다.

- 단발성 오타인가
- 구조적으로 반복될 수 있는가
- 다른 파일에도 같은 패턴이 퍼질 수 있는가

### 4. Rule Promotion

재발 가능성이 있으면 아래 중 하나로 승격한다.

1. `AGENTS.md`에 작업 규칙 추가
2. repository harness 체크 추가
3. application harness 체크 추가
4. save gate 또는 CI gate 추가
5. garbage collection 체크리스트 추가

### 5. Verification

승격한 규칙은 실제로 실패를 막는지 다시 검증해야 한다.
문서에만 적고 자동 검사에 연결하지 않으면 충분하지 않다.

## Promotion Heuristics

아래 조건 중 하나라도 맞으면 규칙 승격 후보로 본다.

1. 같은 실수가 두 번 이상 발생했다
2. 한 번의 실수로 영향 범위가 넓다
3. 사용자 데이터나 안전성과 연결된다
4. AI가 과거 코드 패턴을 따라 반복할 가능성이 높다
5. 사람 리뷰 없이는 놓치기 쉽다

## Output Format

실패를 규칙으로 승격할 때는 최소 아래를 남긴다.

- 실패 설명
- 직접 원인
- 재발 가능성
- 추가할 규칙
- 어느 하네스나 게이트에 넣을지

## Rule

실패를 고치는 것과 실패를 제거하는 것은 다르다.
이 저장소는 후자를 목표로 한다.

## Promoted Rules

### Supabase Temp Storage Failure

- 실패 설명: 임시 이미지 업로드 또는 삭제가 실패하면 onboarding/daily 흐름이 500으로 끝날 수 있다.
- 직접 원인: temp storage 호출이 라우트별로 분산되거나, 삭제가 `finally` 밖으로 밀리면 재발 가능성이 높다.
- 재발 가능성: 높음. AI가 새 라우트를 만들 때 기존 패턴을 따라 wrapper를 빼먹을 수 있다.
- 추가한 규칙:
  - `app/api/feedback/route.ts`, `app/api/daily/route.ts` 는 반드시 `withTemporaryStoredImage(...)` 를 사용한다.
  - 두 라우트는 storage 예외를 `recordStorageRuntimeFailure(...)` 로 기록한다.
  - `lib/supabase/temp-image.ts` 는 삭제를 `finally` 에서 수행한다.
- 연결한 하네스:
  - `harness/architecture/run.py`
  - `tests/e2e/onboarding.spec.ts`

### Next Artifact Parallel Gate Failure

- 실패 설명: `npm run test:e2e`와 `npm run build`를 동시에 실행하면 `.next` 산출물 충돌로 `PageNotFoundError: /_document` 같은 거짓 실패가 발생할 수 있다.
- 직접 원인: 문서에는 병렬 금지 규칙이 있었지만 실행 명령 자체가 병렬 실행을 막지 못했다.
- 재발 가능성: 높음. 에이전트는 빠른 검증을 위해 독립적으로 보이는 명령을 병렬 실행하기 쉽다.
- 추가한 규칙:
  - `npm run build`, `npm run test:e2e`, `npm run visual:app`, `npm run visual:deep-dive`는 병렬 실행하지 않는다.
  - 위 명령은 `scripts/with-next-artifact-lock.py`를 통해 동시 실행을 차단한다.
  - lock 실패는 앱 기능 실패가 아니라 하네스 실행 위반으로 분리 보고한다.
- 연결한 하네스:
  - `package.json` script wrapper
  - `scripts/with-next-artifact-lock.py`
  - `AGENTS.md`
  - `docs/engineering/save-gate.md`

### Platform-Locked Direct Dependency Failure

- 실패 설명: 로컬 서명/런타임 우회를 위해 `wasm32` 전용 패키지를 직접 `devDependencies`에 추가했고, 그 결과 Vercel `npm install`이 `EBADPLATFORM`으로 실패했다.
- 직접 원인: 로컬 문제 우회를 배포 가능한 의존성 구조와 분리하지 않고 저장소 공용 직접 의존성에 넣었다.
- 재발 가능성: 높음. 플랫폼 전용 패키지는 로컬에서 우연히 동작해도 다른 CPU/OS에서 바로 설치 실패를 만든다.
- 추가한 규칙:
  - `package.json`의 직접 `dependencies`/`devDependencies`에는 배포 불가능한 platform-locked package를 넣지 않는다.
  - install 단계 실패는 build 실패와 분리해 `install compatibility` 결함으로 보고한다.
  - `npm run check:deploy`는 직접 의존성에 금지된 platform package가 있으면 실패해야 한다.
  - 로컬 검증 우회가 필요하면 `--no-save` 임시 설치로 처리하고 manifest/lockfile에 남기지 않는다.
- 연결한 하네스:
  - `scripts/check-deploy-readiness.mjs`
  - `tests/unit/deploy-readiness.test.ts`
  - `docs/engineering/deployment-readiness.md`

### Browser State Verification Failure

- 실패 설명: 사용자가 브라우저에서 여전히 로그인 버튼을 보고 있는데도, 에이전트가 테스트 통과와 서버 재시작만 근거로 수정 완료처럼 보고했다.
- 직접 원인: 테스트 서버와 사용자가 실제 보고 있는 현재 서버/브라우저 상태를 분리해서 확인하지 않았다.
- 재발 가능성: 높음. dev server 재시작, 캐시, 다른 실행 세션 때문에 테스트 결과와 현재 화면이 어긋날 수 있다.
- 추가한 규칙:
  - 사용자가 현재 브라우저 상태를 반박하면 기존 테스트 결과보다 현재 서버/브라우저 재확인이 우선이다.
  - "보인다/안 보인다" 같은 UI 수정 완료 보고는 현재 떠 있는 서버를 직접 열어 DOM 또는 새 캡처로 확인한 뒤에만 할 수 있다.
  - dev server를 다시 띄웠다고 해서 사용자가 보고 있는 화면까지 자동으로 갱신됐다고 가정하지 않는다.
- 연결한 하네스:
  - `docs/engineering/verification-matrix.md`
  - 현재 서버 대상 수동 Playwright 확인
