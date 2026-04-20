# Incident: In-App Browser blocked Google login popup

## Symptom

Codex app 내부 브라우저에서 `/login`의 `Google로 계속하기`를 누르면 `Firebase: Error (auth/popup-blocked).`가 노출됐다.
이후 redirect fallback을 추가했지만 로컬 IAB에서 Firebase helper 페이지가 `404`로 뜨고, 로그인 페이지가 `로그인 연결 중...` 상태에 머무를 수 있었다.

## Root Cause

로그인 구현이 Firebase `signInWithPopup`에만 의존했다. 앱 내부 브라우저나 팝업 제한 환경에서는 Google OAuth 팝업이 차단될 수 있으므로, 팝업 방식만으로는 핵심 보호 화면(`/closet`, `/history`, `/profile`) 진입을 검증할 수 없다.
또한 로컬 redirect 로그인에서 Firebase `authDomain`을 현재 앱 host로 바꾸면 SDK가 `https://localhost:3001/__/auth/handler` 또는 `https://127.0.0.1:3001/__/auth/handler`를 열어 `ERR_SSL_PROTOCOL_ERROR`가 난다.
redirect 결과 확인과 프로필 동기화가 끝나지 않을 때 로그인 UI가 무기한 loading으로 남는 방어도 부족했다.

## Fix

- `signInWithPopup` 실패가 `auth/popup-blocked`이면 `signInWithRedirect`로 전환한다.
- 로그인 페이지 부트스트랩 시 `getRedirectResult`를 먼저 확인해 돌아온 Google 인증 결과를 서버 세션으로 승격한다.
- Firebase client `authDomain`은 로컬 host로 바꾸지 않고 Firebase 기본 auth domain을 유지한다.
- `/__/auth/:path*` rewrite는 로컬 helper 경로가 직접 열렸을 때의 안전망으로만 둔다.
- redirect 결과 확인과 서버 세션 생성에 timeout을 둔다.
- Firestore 프로필 동기화는 로그인 완료를 막지 않는 best-effort 작업으로 처리한다.
- Codex/IAB 검증은 실제 Google OAuth에 의존하지 않도록 localhost 전용 개발 세션 발급 API와 `개발용으로 계속하기` 버튼을 제공한다.
- 팝업 차단 fallback과 redirect 결과 처리를 단위 테스트로 고정한다.

## Prevent Recurrence

- Google 로그인은 팝업 전용으로 구현하지 않는다.
- IAB, 자동 브라우저, 팝업 제한 환경에서는 redirect fallback을 지원해야 한다.
- Firebase redirect/popup helper가 `https://localhost:3001` 또는 `https://127.0.0.1:3001`로 열리면 실패다. 기본 Firebase auth domain에서 열려야 한다.
- 로그인 UI는 외부 provider, redirect result, 프로필 동기화 대기 때문에 무기한 loading으로 남으면 실패다.
- Codex 브라우저 검증은 로컬 개발 세션으로 보호 페이지에 진입할 수 있어야 한다.
- 개발 세션 API는 production과 non-localhost에서 닫혀 있어야 한다.
- 로그인 관련 완료 보고는 최소한 단위 테스트, 타입체크, 린트, 보호 라우트 E2E를 통과한 뒤에만 한다.
