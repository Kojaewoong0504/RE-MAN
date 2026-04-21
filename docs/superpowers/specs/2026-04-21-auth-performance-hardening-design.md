# Auth & Performance Hardening Design

## 목적

배포 버전에서 반복적으로 드러난 두 문제를 동시에 줄인다.

1. Google 소셜 로그인 이후 세션 연결이 불안정하다.
2. 앱 첫 진입과 화면 이동에서 `/api/auth/session`과 `/api/credits` 호출이 분산돼 체감 로딩이 느리다.

이번 작업의 목표는 "새 인증 시스템 교체"가 아니라 현재 Firebase + 서버 RTR 구조를 유지하면서 실패 지점을 줄이고 초기 왕복 수를 줄이는 것이다.

## 현재 문제

### 1. 로그인 신뢰성

- `/login`이 canonical production host가 아닌 Vercel alias에서 열릴 수 있다.
- 그 상태에서 Firebase redirect helper/iframe가 alias 기준으로 열리면 브라우저 정책에 따라 실패할 수 있다.
- 클라이언트는 `/api/auth/session` → 401 → `/api/auth/refresh` → 재시도 순서로 세션을 회복한다.
- 즉 로그인 직후 또는 access token 만료 후에도 "한 번 더 왕복해야 세션이 살아나는" 구조다.

### 2. 초기 로딩 비용

- 헤더, 크레딧 배지, 크레딧 기록, 보호 페이지가 각각 auth session을 따로 확인한다.
- `pendingSessionRequest` 덕분에 같은 순간 중복 요청은 어느 정도 막지만, 페이지 이동과 TTL 만료 시 반복된다.
- 크레딧 배지도 auth 확인 후 `/api/credits`를 별도 호출한다.

## 설계 원칙

1. 서버는 가능한 한 한 번의 bootstrap 응답으로 로그인 상태를 확정한다.
2. RTR refresh는 클라이언트가 임의로 여러 번 호출하는 구조가 아니라 bootstrap 경계에서 한 번만 처리한다.
3. public app shell은 access cookie가 있으면 SSR에서 바로 사용자/크레딧을 주입한다.
4. canonical host 강제는 로그인 페이지에도 적용한다.
5. "500ms"는 목표 budget이지 미검증 약속이 아니다. 측정 스크립트를 추가해 숫자로 본다.

## 변경 설계

### A. `/api/auth/bootstrap`

새 bootstrap route는 아래를 수행한다.

1. access token이 유효하면 즉시 사용자 반환
2. access token이 없거나 만료됐으면 refresh + session_state로 RTR 회전
3. 회전 성공 시 새 cookie를 세팅하고 사용자 반환
4. `?include=credits=1`이면 같은 응답에 크레딧 잔액 포함

이 route는 기존 `/api/auth/session` + `/api/auth/refresh` 조합의 클라이언트 round-trip을 하나로 합친다.

### B. 서버 app shell hydrate

`app/layout.tsx`는 access cookie 기준으로 optional 사용자와 크레딧을 읽어 클라이언트 캐시에 주입한다.

- access cookie가 유효하면 첫 paint에서 헤더/배지가 바로 맞게 나온다.
- access cookie가 없지만 refresh cookie만 있는 경우는 클라이언트 bootstrap route가 복구한다.

### C. 클라이언트 캐시 단일화

- auth cache: bootstrap route 기준으로 갱신
- credit cache: bootstrap 응답 또는 `/api/credits` 응답으로 갱신
- `AccountAccessButton`, `CreditStatus`, `CreditLedger`는 직접적인 초기 session fetch 대신 primed cache를 우선 사용

### D. canonical host 강화

middleware matcher를 public route까지 넓혀 `/login`과 `/`도 alias host에서 canonical production host로 보낸다.

이 변경은 배포된 Vercel alias에서 Firebase auth helper가 잘못된 parent/iframe 조합으로 열리는 문제를 줄이기 위한 것이다.

### E. 성능 budget 측정

`scripts/perf-app-shell.mjs`를 추가한다.

- public app shell route 측정: `/`, `/programs/style`, `/login`
- 로컬 dev-login이 가능하면 protected route도 측정: `/closet`, `/history`, `/profile`
- route별 응답 시간을 출력하고 threshold를 넘기면 실패

## 검증

- integration: auth bootstrap route
- integration: middleware canonical host
- typecheck
- lint
- unit/integration existing auth tests
- visual app smoke
- build
- perf app shell measurement

## 보고 규칙

- bootstrap route 추가만으로 "Google OAuth UI 99%" 달성이라고 말하지 않는다.
- 실제 브라우저 OAuth 성공률은 배포 브라우저 검증/telemetry 없이는 수치 보장으로 보고하지 않는다.
- `perf:app-shell` 결과를 확인하기 전에는 `500ms 이하` 달성이라고 말하지 않는다.
