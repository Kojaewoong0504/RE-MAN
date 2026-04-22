# Incident: Try-on preview overflowed onboarding localStorage quota

## Symptom

배포 버전 결과 화면에서 실착 이미지 생성 직후 아래 오류가 노출됐다.

`Failed to execute 'setItem' on 'Storage': Setting the value of 'reman:onboarding' exceeded the quota.`

## Root Cause

`lib/onboarding/storage.ts`의 `writeOnboardingState()`가 onboarding 전체 상태를 그대로 `localStorage`에 저장했다.
실착 결과의 `preview_image`와 `stage_previews[].preview_image`가 base64 data URL이라서, 기존 전신 사진과 옷장 로컬 이미지가 함께 남아 있는 상태에서 브라우저 quota를 초과했다.

## Fix

- `writeOnboardingState()`에 quota 예외 폴백을 추가했다.
- 1차 폴백: `try_on_previews`의 binary 이미지(`preview_image`, `stage_previews[].preview_image`)를 제거하고 재시도.
- 2차 폴백: 그래도 실패하면 onboarding 원본 사진과 옷장 로컬 data URL까지 제거하고 재시도.
- 결과 화면은 저장된 try-on 캐시에 실제 `preview_image`가 있을 때만 복원하도록 보정했다.

## Prevent Recurrence

- 브라우저 storage에는 base64 대형 이미지를 장기 캐시로 신뢰하지 않는다.
- 실착/업로드/옷장 미리보기처럼 data URL이 붙는 상태는 quota 폴백 단위 테스트를 유지한다.
- 배포 버전 오류는 provider 문제와 별개로 `storage` 경계로 분리해 기록한다.

## Verification

- `tests/unit/onboarding-storage.test.ts`
  - quota 발생 시 실착 binary를 먼저 제거하고 저장되는지 검증
  - 추가 quota 발생 시 로컬 이미지까지 제거하고 저장되는지 검증
- `npm run typecheck`
