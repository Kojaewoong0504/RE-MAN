# Architecture Harness

이 디렉토리는 레이어 경계와 구조 불변조건을 검사한다.

현재 `v0`는 아래를 검사한다.

1. `components/` 는 `app/api/` 를 import하지 않는다
2. `lib/` 는 `components/` 나 `app/` 를 import하지 않는다
3. `app/api/` 는 `components/` 를 import하지 않는다
4. 핵심 API route가 문서와 코드 모두에 존재한다
5. `/api/try-on`은 공통 세션 인증 헬퍼, rate limit, provider 실패 분류, 안전한 fallback 메시지를 유지한다
6. try-on UI는 컨테이너/표시 파트/레퍼런스 생성/클라이언트 유틸/타입 파일로 분리한다
