# Auth & Performance Hardening Plan

## 목표

- Firebase + 서버 RTR 구조를 유지하면서 로그인 세션 복구를 bootstrap 한 번으로 정리한다.
- 헤더/크레딧/보호 페이지의 초기 auth 왕복을 줄인다.
- canonical host 강제를 로그인 페이지까지 확장한다.
- app shell 응답 시간을 숫자로 보는 perf script를 추가한다.

## 작업 항목

### 1. Auth bootstrap 경계 추가

- [ ] `lib/auth/server.ts`에 cookie 값으로 access/refresh/session_state를 해석하는 helper를 추가한다.
- [ ] `app/api/auth/bootstrap/route.ts`를 추가한다.
- [ ] `include=credits` 옵션으로 사용자 + 크레딧을 함께 반환한다.
- [ ] integration test를 추가한다.

### 2. 클라이언트 캐시 단일화

- [ ] auth client가 `/api/auth/session` + `/api/auth/refresh` 대신 bootstrap route를 사용하게 바꾼다.
- [ ] credit cache helper를 분리한다.
- [ ] `AccountAccessButton`, `CreditStatus`, `CreditLedger`, `FirebaseSessionBootstrap`, `LoginPageClient`를 bootstrap cache 기준으로 바꾼다.

### 3. 서버 app shell hydrate

- [ ] `app/layout.tsx`를 async layout으로 전환한다.
- [ ] access cookie 기준 사용자/크레딧을 읽어 hydrator로 전달한다.
- [ ] 첫 화면 헤더/크레딧 배지가 cache primed 상태로 붙는지 확인한다.

### 4. canonical host 강화

- [ ] middleware matcher를 public route까지 넓힌다.
- [ ] `/login`과 `/`도 alias host에서 canonical host로 redirect 되는지 테스트한다.
- [ ] deployment readiness 문서에 규칙을 추가한다.

### 5. 성능 측정

- [ ] `scripts/perf-app-shell.mjs` 추가
- [ ] `package.json`에 script 등록
- [ ] verification matrix / docs index 갱신

## 검증 순서

1. `npm run test:integration -- tests/integration/auth-bootstrap-route.test.ts tests/integration/middleware.test.ts tests/integration/auth-session-flow.test.ts`
2. `npm run typecheck`
3. `npm run lint`
4. `npm run check:content`
5. `npm run check:mvp`
6. `npm run check:gc`
7. `npm run perf:app-shell`
8. `npm run visual:app`
9. `npm run build`

## 완료 기준

- 로그인 세션 bootstrap이 access/refresh 상태 모두에서 한 번의 route로 복구된다.
- public 화면 헤더와 크레딧 배지가 추가 auth fetch 없이 primed cache를 사용한다.
- `/login`이 alias host에서 canonical production host로 redirect 된다.
- perf script가 숫자를 출력하고 threshold를 초과하면 실패한다.
