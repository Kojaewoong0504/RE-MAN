# RE:MAN System Reference And Vertex Validation Design

## Goal

이번 단계의 목표는 두 가지다.

1. 시스템 추천 이미지를 임시 SVG placeholder가 아니라 실제 의상처럼 보이는 정적 reference 이미지로 교체한다.
2. 배포 버전에서 현재 RE:MAN의 실착 경로가 실제 Vertex 응답을 받아 성공하는지 검증 가능한 상태로 만든다.

핵심은 MVP가 "보이는 것만 그럴듯한 상태"가 아니라, 배포 환경에서 실제 추천 이미지와 실제 실착 생성이 이어지는지 확인하는 것이다.

## Scope

이번 단계에서 포함하는 것:

- `public/system-catalog/`에 남성 기본템 실사형 reference 이미지 세트 추가
- `lib/product/system-style-library.ts`의 `image_url`을 실사형 reference로 교체
- 결과 화면에서 system recommendation이 실사형 reference로 렌더되도록 유지
- 현재 `outfit board` 기반 `/api/try-on` 경로를 그대로 사용하면서 Vertex 성공 검증을 위한 입력 품질 상향
- `fitreco`의 Vertex/VTO 구현을 참고해 다음 단계 확장 방향을 문서에 명시

이번 단계에서 포함하지 않는 것:

- layered try-on을 RE:MAN 메인 경로에 바로 도입
- 크레딧 차감 규칙을 다단계 try-on 기준으로 재설계
- 중간 실착 결과 저장, 복구, 재시도 orchestration
- 시스템 추천을 상품 DB 또는 구매 CTA와 연결

## Why This Scope

현재 RE:MAN은 결과 화면에서 `/api/try-on` CTA와 Vertex provider 계약을 이미 가지고 있다. 하지만 system recommendation 이미지가 placeholder 성격이 강해서, outfit board 입력의 시각 품질이 낮다. 이 상태에서는 배포 검증이 되어도 "실제 의상 기반 검증"이라고 보기 어렵다.

반면 `fitreco`는 Vertex Virtual Try-On을 실제 의류 이미지 기준으로 호출했고, 순차 레이어링도 실험했다. 다만 그 구조를 지금 바로 RE:MAN 본선에 넣으면 다음 문제가 생긴다.

- 한 번의 CTA에 여러 번의 provider 호출이 발생할 수 있다.
- 각 단계별 실패와 환불 규칙을 다시 정의해야 한다.
- 중간 이미지 캐시와 재시도 범위가 새로 필요하다.

따라서 이번 단계는 "reference quality 개선 + 현재 경로의 실사용 검증"에 집중한다.

## Current Architecture Choice

이번 단계의 실착 입력 경로는 아래로 고정한다.

1. 사용자 전신 사진 1장
2. 추천 상의, 하의, 신발을 묶은 `outfit board` 1장
3. `/api/try-on` POST
4. `TRY_ON_PROVIDER=vertex`일 때 Vertex 응답을 받아 결과 이미지 반환

즉, API 입력 수는 지금처럼 2장만 유지한다. 하네스와 API 계약도 이 경계를 기준으로 유지한다.

## Reference Image Design

정적 system reference는 남성 기본템 중심으로 구성한다.

- tops: 8종
- bottoms: 6종
- shoes: 4종
- outerwear: 4종

이미지는 모두 아래 조건을 만족해야 한다.

- 실제 의류 사진 또는 실제 의류에 매우 가까운 생성 이미지
- 배경이 과하게 복잡하지 않을 것
- 의류 형태와 색이 한눈에 보일 것
- outfit board에 넣었을 때 category 식별이 쉬울 것
- 구매 CTA나 브랜드 과시는 포함하지 않을 것

파일 경로 예시는 아래와 같다.

- `/system-catalog/tops/sky-oxford-shirt.png`
- `/system-catalog/bottoms/black-tapered-slacks.png`
- `/system-catalog/shoes/white-minimal-sneakers.png`
- `/system-catalog/outerwear/navy-blouson.png`

기존 SVG fallback은 제거하지 않는다. fallback은 계속 남기되, 기본 `image_url`만 실사형 reference로 교체한다.

## Source Of Truth

시스템 추천의 출처 데이터는 계속 `lib/product/system-style-library.ts`다.

이번 단계에서 바뀌는 것은 다음뿐이다.

- `image_url` 경로를 실사형 정적 이미지로 변경
- 필요하면 기본 library 항목 수를 확대

바뀌지 않는 것은 다음이다.

- `mode = "reference"`
- `product = null`
- 결과 화면에서 `시스템 추천 참고` 출처 라벨 유지

즉, 사용자는 더 현실적인 이미지를 보지만, 시스템 추천이 확정 구매 추천처럼 보이지 않게 한다.

## fitreco Reference Learnings

`fitreco/src/lib/vto/vtoService.ts`에서 이번 단계에 직접 반영할 포인트는 아래다.

1. Vertex 입력은 실제 의류 이미지 품질에 크게 의존한다.
2. 이미지를 base64로 정규화한 뒤 provider에 보내는 구조가 안정적이다.
3. layered try-on은 "이전 결과를 다음 단계의 personImage로 쓰는 순차 체인"으로 구현할 수 있다.

이번 단계에서 RE:MAN이 바로 가져오지 않는 포인트는 아래다.

- `executeLayeredTryOn` 같은 다단계 provider orchestration
- 상의/하의/신발 순차 합성
- 중간 산출물 관리

이것은 다음 단계 후보로 남긴다.

## Verification Plan

완료 보고 기준은 다음 순서를 따른다.

1. system recommendation이 결과 화면에서 실사형 이미지로 보이는지 시각 검증
2. `npm run test:e2e -- --grep "saved result shows outfit previews and allows try-on generation"` 재통과
3. `TRY_ON_PROVIDER=vertex` 상태에서 `npm run smoke:try-on:vertex` 실행
4. 필요 시 `npm run check:deploy:strict`로 deploy readiness 확인

실패 시 원인은 반드시 아래 중 하나로 분리해서 보고한다.

- config
- auth
- upstream Vertex response
- input image quality or format

`mock` 경로 통과를 실제 Vertex 성공으로 보고하면 실패다.

## Risks

가장 큰 리스크는 reference 이미지 품질이 낮으면 outfit board를 써도 Vertex 결과가 부자연스러울 수 있다는 점이다. 이 경우 이번 단계는 "실제 호출 성공과 실사 reference 확보"까지로 보고, 이미지 품질 개선은 reference 재선정 또는 layered try-on 실험으로 넘긴다.

또 다른 리스크는 배포 환경의 Vertex 인증 또는 Storage URI 설정 누락이다. 이 경우 하네스 기준에 따라 설정 누락과 provider 실패를 분리해서 보고해야 한다.

## Next Step After This Design

다음 단계 후보는 `layered try-on experimental path`다.

구상은 아래와 같다.

1. 하의 실착 생성
2. 그 결과를 person image로 다시 사용
3. 상의 실착 생성
4. 필요 시 신발 또는 outerwear는 별도 전략 적용

하지만 이것은 현재 MVP 검증 이후에 다룬다. 이유는 다단계 크레딧 정책, 실패 환불, 중간 결과 저장 정책이 새로 필요하기 때문이다.

## Acceptance Criteria

- system recommendation 기본 이미지는 placeholder SVG가 아니라 실사형 reference를 우선 사용한다.
- 결과 화면에서 system recommendation이 여전히 `reference` 출처로 보인다.
- 현재 outfit board 기반 `/api/try-on` 경로는 유지된다.
- 실사형 reference를 포함한 결과 화면 기준으로 Vertex 실착 smoke 성공 여부를 검증할 수 있다.
- layered try-on은 이번 단계 본선 구현 범위에 포함되지 않는다.
