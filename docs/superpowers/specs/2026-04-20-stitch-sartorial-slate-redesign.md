# Stitch Sartorial Slate Redesign Spec

## Purpose

Stitch 프로젝트 `RE:MEN`의 `Sartorial Slate` 디자인 시스템을 현재 앱에 이식한다.
Stitch HTML을 그대로 붙이지 않고, 현재 앱의 인증, 크레딧, 온보딩 상태, 하네스 검증 구조를 유지한다.

## Visual Thesis

RE:MEN은 밝은 스톤 앱에서 딥 네이비 기반의 `Architectural Concierge` 경험으로 이동한다.
사용자는 패션 앱이 아니라 조용한 스타일 컨시어지를 쓰는 느낌을 받아야 한다.

## Scope

- Design tokens: `Sartorial Slate` 색상과 라운드, 톤 레이어링을 `app/globals.css`에 반영한다.
- Home: Stitch `홈 화면`의 구조를 참고해 상단 진단/점수/오늘의 추천/바로가기를 더 앱답게 정리한다.
- Style: Stitch `Style Analysis`의 다크 이미지 앵커와 3-step 구조를 현재 스타일 시작 화면에 반영한다.
- Result: Stitch `스타일 분석 결과`의 네이비 hero, 결과 요약, 추천 조합 구조를 현재 결과 화면에 반영한다.
- Closet: Stitch `Add to Closet`/`옷장 등록`의 segmented controls, dark CTA, 사진 중심 등록 무드를 반영한다.

## Non-Goals

- Stitch HTML을 직접 라우트에 복사하지 않는다.
- 인증/크레딧/Firestore/Supabase/Gemini 로직을 변경하지 않는다.
- 실착 생성이나 deferred 기능을 다시 노출하지 않는다.
- 하단 탭 구조를 제거하지 않는다.

## Design Rules

- 1px 보더는 구조 전체를 감싸는 기본값으로 남발하지 않는다.
- 분리는 `surface`, `surface-container-low`, `surface-container-highest` 톤 차이로 만든다.
- Primary CTA는 딥 네이비 그라디언트로 통일한다.
- 성공/진행 신호는 muted emerald 계열만 사용한다.
- 주요 화면의 첫 뷰포트는 이미지 또는 강한 톤 블록이 시각 앵커가 되어야 한다.

## Verification

- `npm run visual:app` 결과에서 home, style, result, closet 캡처를 직접 확인한다.
- `npm run test:e2e -- tests/e2e/onboarding.spec.ts`로 핵심 흐름을 유지한다.
- `npm run build`, `npm run typecheck`, `npm run lint`, 하네스 체크가 통과해야 한다.
