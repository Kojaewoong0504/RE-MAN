# Closet Batch Capture Design

## Purpose

옷장 등록은 RE:MEN MVP의 추천 품질을 결정하는 핵심 입력이다. 사용자가 옷에 관심이 없더라도 사계절 옷은 50개를 쉽게 넘기므로, 한 벌씩 폼을 채우는 방식은 실패한다.

이 설계의 목표는 사용자가 옷 사진을 빠르게 많이 넣고, AI가 데이터 초안을 만들며, 사용자는 확인과 수정만 하게 만드는 것이다.

## Product Principle

- 기본 경험은 `대량 촬영 -> AI 초안 -> 사용자 확인 -> 저장`이다.
- 사용자는 이름, 카테고리, 색상, 계절, 상태를 처음부터 직접 입력하지 않는다.
- AI가 추정한 값은 저장 전까지 확정 데이터가 아니다.
- 사이즈는 사진 1장만으로 확정하지 않는다. 1차에서는 비워두거나 낮은 신뢰도의 추정값으로만 둔다.
- 일부 사진 분석이 실패해도 전체 등록을 막지 않는다.

## User Flow

```text
/옷장
  -> + 버튼
  -> 빠른 촬영으로 여러 벌 추가
  -> 여러 이미지 선택 또는 연속 촬영
  -> 사진별 분석 상태 표시
  -> AI 초안 카드 확인
  -> 맞음 / 수정 / 삭제
  -> 저장
  -> 옷장 목록 반영
```

## Screens

### `/closet`

기존 옷장 화면의 `+` 버튼은 단일 등록 폼으로 바로 열리지 않는다. 먼저 등록 방식을 고르게 한다.

- `빠른 촬영`: 기본 추천 옵션
- `한 벌 직접 등록`: 보조 옵션

### `/closet/batch`

여러 이미지를 추가하는 작업 화면이다.

- 이미지 여러 장 선택
- 모바일 카메라 연속 촬영
- 사진별 썸네일
- `대기중`, `분석중`, `확인 필요`, `분석 실패` 상태
- 분석 시작 CTA

### `/closet/review`

AI 초안을 저장 전 확인하는 화면이다.

- 사진 카드
- AI 추정값: 카테고리, 이름, 색상, 옷 종류, 계절, 상태
- 신뢰도 낮은 필드는 `확인 필요`로 표시
- 사용자 액션: `맞아요`, `수정`, `삭제`
- 전체 저장 CTA

## Data Model

현재 `ClosetItem`은 사용자가 확정한 옷장 데이터로 유지한다. 대량 촬영 과정에서는 별도 draft 모델을 사용하고, 저장 시점에만 `ClosetItem`으로 승격한다.

```ts
type ClosetAnalysisStatus =
  | "pending"
  | "analyzing"
  | "needs_review"
  | "confirmed"
  | "failed";

type ClosetItemDraft = {
  id: string;
  photo_data_url: string;
  analysis_status: ClosetAnalysisStatus;
  category?: "tops" | "bottoms" | "shoes" | "outerwear";
  name?: string;
  color?: string;
  detected_type?: string;
  fit?: string;
  season?: string;
  condition?: string;
  size?: string;
  analysis_confidence?: number;
  size_source?: "manual" | "label_ocr" | "measurement_estimate" | "unknown";
  size_confidence?: number;
  error_message?: string;
};
```

저장 시 `confirmed` 또는 사용자가 수동 수정한 draft만 `ClosetItem`으로 변환한다. `failed`나 삭제된 draft는 저장하지 않는다.

## API Contract

1차 구현은 provider 경계를 먼저 만든다.

```text
POST /api/closet/analyze
```

요청:

```json
{
  "image": "<base64 data url>"
}
```

응답:

```json
{
  "category": "tops",
  "name": "네이비 셔츠",
  "color": "네이비",
  "detected_type": "셔츠",
  "fit": "레귤러",
  "season": "봄/가을",
  "condition": "깨끗함",
  "analysis_confidence": 0.82,
  "size": "",
  "size_source": "unknown",
  "size_confidence": 0
}
```

Provider:

```text
CLOSET_ANALYSIS_PROVIDER=mock | gemini
```

- `mock`: UI, E2E, 테스트용 결정론적 응답
- `gemini`: 실제 Vision 기반 옷 태깅

## Error Handling

- 이미지 형식/용량 오류: 해당 draft만 실패 처리
- AI 응답 실패: 해당 draft를 `failed`로 두고 수동 수정 가능하게 한다
- AI 포맷 불일치: 최대 1회 재시도 후 `failed`
- 일부 실패: 나머지 성공 draft는 저장 가능
- 전체 저장 실패: Firestore 저장 실패 메시지를 보여주고 draft는 유지한다

## Size Strategy

1차에서는 옷 사진만으로 실제 치수를 확정하지 않는다.

- 사진에서 추정 가능한 값: 카테고리, 색상, 옷 종류, 계절감, 상태
- 사진만으로 확정 금지: 실제 총장, 어깨너비, 허리단면, 브랜드 사이즈
- 사이즈 필드는 기본 `unknown`으로 둔다
- 추후 `label_ocr` 또는 `measurement_estimate`가 붙을 때 `size_source`로 구분한다

## Harness Rules

- `CLOSET_ANALYSIS_PROVIDER=mock` 통과를 실제 옷 인식 성공으로 보고하지 않는다.
- AI 추정값은 사용자 확인 전까지 추천 핵심 근거로 쓰지 않는다.
- confidence가 낮은 draft는 반드시 `확인 필요` 상태로 둔다.
- 대량 등록은 일부 실패해도 전체 저장을 막지 않는다.
- 저장 전 삭제한 draft는 `closet_items`와 저장 payload에 포함하지 않는다.
- 대량 등록 E2E는 최소 3장 업로드, 1장 수정, 1장 삭제, 1장 저장을 검증한다.
- visual smoke는 `/closet/batch`와 `/closet/review` 모바일 캡처를 포함한다.

## Verification

- Unit: `ClosetItemDraft -> ClosetItem` 변환, 실패/삭제 draft 제외
- Unit: provider 응답 정규화와 confidence threshold
- Integration: `/api/closet/analyze` mock 응답 계약
- E2E: 3장 추가, 분석, 1장 수정, 1장 삭제, 저장 후 옷장 반영
- Visual: 모바일/데스크톱 batch/review 화면 캡처
- Build: `npm run build`

## Deferred Scope

- 라벨 OCR
- 기준 물체 기반 실측
- 상품 검색/품번 검색
- 판매중인 상품 추천
- 자동 치수 확정

이 기능들은 대량 촬영 등록이 안정화된 뒤 별도 설계로 분리한다.
