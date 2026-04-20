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
```

- `check:deploy`는 배포 환경이 실제 AI인지 mock인지 드러낸다.
- `check:deploy:strict`는 MVP 필수 AI 기능인 스타일 분석과 옷장 대량 등록이 real provider가 아니면 실패로 처리한다.
- 실착 이미지는 현재 MVP 필수 경로가 아니므로 `TRY_ON_PROVIDER=mock`이면 경고만 낸다.
- `check:deploy:vercel`은 Vercel production env를 `.env.vercel.local`로 pull한 뒤 strict 검사를 실행한다.
- Vercel production env를 로컬에서 확인할 때는 secret 값을 출력하지 말고 env를 pull한 뒤 검사한다.

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
- 배포 확인은 `npm run check:deploy:strict`와 배포 URL 대상 smoke test를 분리해서 보고한다.

## Required Next Step For Paid Closet AI

옷장 대량 등록을 실제 과금 AI 기능으로 만들려면 아래 순서로 진행한다.

1. Vercel production에 `CLOSET_ANALYSIS_PROVIDER=gemini` 설정
2. Vercel production에 `GOOGLE_API_KEY`, `AUTH_JWT_SECRET`, Firebase server env 설정
3. `npm run check:deploy:vercel` 통과
4. 배포 URL에서 스타일 분석 smoke와 옷장 대량 등록 smoke 수행
