# Verification Matrix

## Purpose

검증 명령은 모두 같은 의미가 아니다.
이 문서는 각 명령이 무엇을 증명하는지와, 완료 보고에서 사용할 수 있는 문구를 고정한다.

## Commands

| Command | Proves | Completion wording |
|---|---|---|
| `npm run typecheck` | TypeScript 타입 경계가 깨지지 않음 | typecheck 통과 |
| `npm run lint` | ESLint 규칙 위반 없음 | lint 통과 |
| `npm run test:unit` | 순수 함수, 계약, 크레딧 계산, 추천 매칭 단위 검증 | unit tests 통과 |
| `npm run test:integration` | API route, auth, credit, middleware 통합 경계 검증 | integration tests 통과 |
| `npm run check:repo` | 루트 문서와 repository harness 규칙 검증 | repository harness 통과 |
| `npm run check:app` | agent contract fixtures 검증 | application harness 통과 |
| `npm run check:content` | 금지 표현과 구매 유도 content rule 검증 | content rules 통과 |
| `npm run check:architecture` | 구조 규칙 검증 | architecture harness 통과 |
| `npm run check:gc` | 문서/코드 drift와 GC 규칙 검증 | gc harness 통과 |
| `npm run check:mvp` | MVP critical path와 verification matrix 문서/스크립트 연결 검증 | MVP harness 통과 |
| `npm run check:deploy` | 배포 환경에서 기능별 real AI/mock, 크레딧 경계, 필수 env 상태 확인 | deployment readiness 통과 또는 mock/미구현 경고 확인 |
| `npm run check:deploy:strict` | 실제 AI/크레딧 시나리오로 보고 가능한지 강제 검증 | strict deployment readiness 통과 |
| `npm run check:deploy:vercel` | Vercel production env를 pull한 뒤 strict readiness 검증 | Vercel production readiness 통과 |
| `npm run test:e2e` | mock provider 기반 브라우저 사용자 흐름 검증 | mock E2E 통과 |
| `npm run smoke:feedback:gemini` | 실제 Gemini API 응답 계약 검증 | 실제 Gemini API 계약 통과 |
| `npm run smoke:feedback:browser` | 브라우저 업로드 흐름과 실제 Gemini 경계 검증 | 브라우저 업로드와 실제 Gemini 경계 통과 |
| `npm run smoke:closet:gemini` | 옷장 AI 초안 API가 실제 Gemini provider와 크레딧 차감을 통과 | 실제 옷장 AI+크레딧 smoke 통과 |
| `npm run smoke:production:mvp` | 배포 URL에서 로그인 세션, 크레딧 잔액, 옷장 등록, 스타일 분석, 반응 저장, 기록 이동을 한 번에 검증 | 배포 MVP golden path 통과 |
| `npm run visual:app` | 홈, 스타일, 업로드, 분석, 결과, 옷장, 기록, 내 정보, 설정 화면의 캡처 생성 | visual smoke 통과 및 산출물 확인 |
| `npm run build` | Next.js production build 가능 | build 통과 |

## Feature Gates

| Feature | Required verification | Commands | Reporting limit |
|---|---|---|---|
| Closet batch capture | Unit + integration + E2E + visual + real provider smoke | `npm run test:unit -- tests/unit/closet-batch.test.ts`, `npm run test:integration -- tests/integration/closet-analyze-route.test.ts`, `npm run test:e2e`, `npm run visual:app`, `npm run smoke:closet:gemini` | mock provider only unless `CLOSET_ANALYSIS_PROVIDER=gemini` smoke passes |
| Deployed real AI + credits | Env readiness + provider smoke + credit route tests + 배포 URL golden path | `npm run check:deploy:strict`, `npm run smoke:feedback:gemini`, `npm run smoke:production:mvp`, `npm run test:integration -- tests/integration/feedback-route.test.ts tests/integration/credit-transactions-route.test.ts` | `smoke:production:mvp` 전에는 로컬/환경 readiness까지만 보고 |

## Sequential Commands

아래 명령은 `.next` 또는 3001 포트 브라우저 서버를 공유하므로 병렬 실행하지 않는다.

- `npm run test:e2e`
- `npm run visual:app`
- `npm run visual:deep-dive`
- `npm run build`

이 명령들은 `scripts/with-next-artifact-lock.py`를 통해 실행되어야 한다.

## Forbidden Reporting

- `npm run test:e2e`만 실행하고 실제 Gemini 사진 분석이 된다고 말하지 않는다.
- `npm run typecheck`와 `npm run lint`만 실행하고 사용자 플로우가 통과했다고 말하지 않는다.
- `npm run visual:app`을 실행하지 않고 UI 배치가 확인됐다고 말하지 않는다.
- 실패한 명령이 있으면 숨기지 않는다.
- 실패는 `auth`, `credit`, `payload`, `provider`, `storage`, `ui`, `visual`, `harness` 중 하나로 분류한다.
- `npm run check:deploy` 경고를 무시하고 배포 기능이 실제 AI/크레딧으로 동작한다고 말하지 않는다.
- `npm run smoke:production:mvp` 없이 배포 URL에서 로그인, 크레딧 차감, 분석, 기록 확인이 끝까지 된다고 말하지 않는다.

## Visual Evidence

`npm run visual:app`이 생성하는 주요 산출물은 아래 위치에 있다.

- `output/playwright/app-visual-smoke/mobile-home.png`
- `output/playwright/app-visual-smoke/mobile-style.png`
- `output/playwright/app-visual-smoke/mobile-upload.png`
- `output/playwright/app-visual-smoke/mobile-result.png`
- `output/playwright/app-visual-smoke/mobile-closet.png`
- `output/playwright/app-visual-smoke/mobile-closet-batch.png`
- `output/playwright/app-visual-smoke/mobile-closet-review.png`
- `output/playwright/app-visual-smoke/mobile-history.png`
- `output/playwright/app-visual-smoke/mobile-profile.png`
- `output/playwright/app-visual-smoke/mobile-settings.png`
- `output/playwright/app-visual-smoke/desktop-home.png`
- `output/playwright/app-visual-smoke/desktop-style.png`
- `output/playwright/app-visual-smoke/desktop-result.png`
- `output/playwright/app-visual-smoke/desktop-closet.png`
- `output/playwright/app-visual-smoke/desktop-closet-batch.png`
- `output/playwright/app-visual-smoke/desktop-closet-review.png`
