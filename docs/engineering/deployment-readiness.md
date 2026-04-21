# Deployment Readiness

## Purpose

배포 전 확인해야 할 것은 "페이지가 열린다"가 아니라 실제 시나리오가 어떤 provider와 비용 경로를 타는지다.

현재 MVP의 AI/크레딧 경계는 기능별로 다르다.

| Feature | Route | Real AI ready | Credit ready | Current gate |
|---|---|---:|---:|---|
| 스타일 분석 | `/api/feedback` | `AI_PROVIDER=gemini` + Gemini env 필요 | 예 | `npm run check:deploy` |
| 옷장 대량 등록 초안 | `/api/closet/analyze` | `CLOSET_ANALYSIS_PROVIDER=gemini` + Gemini env 필요 | 예 | `npm run check:deploy` |
| 실착 이미지 | `/api/try-on` | 선택 기능. `TRY_ON_PROVIDER=vertex` + Vertex env 필요 | 조건부 | `npm run check:deploy` |

## Commands

```bash
npm run check:deploy
npm run check:deploy:strict
npm run check:deploy:vercel
npm run perf:app-shell
SMOKE_BASE_URL=https://<deployment-url> npm run smoke:production:mvp
```

- `check:deploy`는 배포 환경이 실제 AI인지 mock인지 드러낸다.
- `check:deploy:strict`는 MVP 필수 AI 기능인 스타일 분석과 옷장 대량 등록이 real provider가 아니면 실패로 처리한다.
- 실착 이미지는 현재 MVP 필수 경로가 아니므로 `TRY_ON_PROVIDER=mock`이면 경고만 낸다.
- `check:deploy:vercel`은 Vercel production env를 `.env.vercel.local`로 pull한 뒤 strict 검사를 실행한다.
- `check:deploy`는 `package.json` 직접 의존성에 Vercel/Linux 설치 단계에서 깨지는 platform package가 있는지도 같이 확인한다.
- `perf:app-shell`은 주요 화면의 응답 시간을 budget 기준으로 측정한다.
- `smoke:production:mvp`는 배포 URL에서 로그인 세션, 크레딧 잔액, 옷장 등록, 스타일 분석, 반응 저장, 기록 이동을 한 번에 확인한다.
- `smoke:production:mvp`는 테스트 세션을 발급하므로 실제 Google OAuth UI를 검증하지 않는다.
- 배포에서 크레딧 원장을 실제 원장으로 보고하려면 `CREDIT_LEDGER_PROVIDER=firestore`가 필요하다. 값이 없으면 memory fallback이며 strict readiness는 실패한다.
- Vercel production env를 로컬에서 확인할 때는 secret 값을 출력하지 말고 env를 pull한 뒤 검사한다.
- `npm install` 단계에서 깨지는 문제는 build 실패가 아니라 install compatibility 실패로 분리해서 보고한다.
- `@rolldown/binding-wasm32-wasi` 같은 `wasm32` 전용 패키지를 직접 `dependencies` 또는 `devDependencies`에 추가하면 배포 금지다. 이런 우회는 공용 저장소 의존성이 아니라 로컬 전용 방법으로 분리해야 한다.
- 로컬 검증이 platform package를 잠깐 필요로 하면 `--no-save` 임시 설치나 로컬 스크립트로 처리하고 lockfile/manifest에는 남기지 않는다.

```bash
vercel env pull .env.vercel.local --environment=production
npm run check:deploy:strict
```

또는 아래 단일 명령을 사용한다.

```bash
npm run check:deploy:vercel
```

`.env.vercel.local`은 커밋하지 않는다.

## Reporting Rules

- `AI_PROVIDER=gemini`과 `npm run smoke:feedback:gemini` 통과 전에는 배포 스타일 분석이 실제 Gemini로 동작한다고 말하지 않는다.
- `CLOSET_ANALYSIS_PROVIDER=mock` 상태에서는 옷장 대량 등록이 실제 옷 인식이라고 말하지 않는다.
- `/api/closet/analyze`는 `Idempotency-Key`, 원장 기록, 실패 환불을 포함한 크레딧 경로를 사용한다.
- `/api/closet/analyze`를 호출하는 클라이언트는 draft별 안정적인 `Idempotency-Key`를 반드시 전송해야 한다. 이미 `needs_review` 또는 `confirmed` 상태인 draft를 다시 분석 호출하면 중복 차감 위험이므로 실패다.
- 배포 확인은 `npm run check:deploy:strict`와 배포 URL 대상 `npm run smoke:production:mvp`를 분리해서 보고한다.
- 배포 Google 소셜 로그인은 `smoke:production:mvp`와 별개로 실제 브라우저 OAuth 완료와 앱 세션 쿠키 발급을 확인해야 한다.
- 모바일/IAB 로그인은 redirect 우선 흐름이어야 한다. popup fallback만으로는 모바일 로그인 검증으로 보지 않는다.
- Vercel alias host가 아니라 canonical production host에서 로그인해야 한다. `/login`과 public route도 alias host면 canonical production host로 redirect 되어야 한다.
- 사용자 사진 업로드 경로는 갤러리 선택과 카메라 촬영 input을 모두 제공해야 한다.
- 크레딧 원장이 memory 기반이면 `check:deploy:strict`는 실패해야 한다. 서버리스 배포에서는 memory 원장을 실제 사용량 기록으로 보고하지 않는다.

## Required Next Step For Paid Closet AI

옷장 대량 등록을 실제 과금 AI 기능으로 만들려면 아래 순서로 진행한다.

1. Vercel production에 `CLOSET_ANALYSIS_PROVIDER=gemini` 설정
2. Vercel production에 `GOOGLE_API_KEY`, `AUTH_JWT_SECRET`, Firebase server env 설정
3. Vercel production에 `CREDIT_LEDGER_PROVIDER=firestore` 설정
4. `npm run check:deploy:vercel` 통과
5. 배포 URL에서 `npm run smoke:production:mvp`와 옷장 대량 등록 smoke 수행
