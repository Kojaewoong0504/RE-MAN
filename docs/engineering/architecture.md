# ARCHITECTURE.md

## 개요

웹앱 기준 MVP 아키텍처.
빠른 배포와 최소 인프라 운영이 목표 — 복잡한 백엔드 없이 시작한다.
단, 정보 구조는 `단일 스타일 앱`이 아니라 `여러 변화 프로그램을 담는 허브`를 기준으로 설계한다.

---

## 기술 스택

| 영역 | 기술 | 이유 |
|---|---|---|
| 프론트엔드 | Next.js (React) | App Router 기반 SSR, API Route 내장 |
| 배포 | Vercel | Next.js 최적화, 무중단 배포 |
| 데이터베이스 | Firebase Firestore | 실시간 DB, 인증 통합, 빠른 세팅 |
| 인증 | Firebase Auth + App JWT Session | Google 로그인, 서버 JWT 세션 분리 |
| AI 피드백 | Gemini API (Google) | Vision 지원, 멀티모달 피드백 |
| 실착 미리보기 | Vertex AI Virtual Try-On (실험) | 사람 사진 + 상품 사진 기반 실착 이미지 생성 후보 |
| 사진 업로드 | Supabase Storage | 임시 이미지 업로드 후 분석 직후 삭제 |
| 이메일 발송 | Resend | 간단한 API, Next.js 친화적 |

---

## 시스템 구조

```
[유저 브라우저]
      ↓ HTTP
[Next.js App - Vercel]
  ├── /app (페이지 라우팅)
  │   ├── /                    ← 상태 분기 홈
  │   ├── /programs           ← 기능 선택 허브
  │   ├── /programs/style     ← 스타일 프로그램 진입
  │   └── /programs/style/... ← 스타일 onboarding / result / day flow
  │
  └── /app/api (서버사이드 API Routes)
      ├── POST /api/feedback      ← onboarding-agent 호출
      ├── POST /api/deep-dive     ← 선택형 deep dive 호출 (`fit`, `color`, `occasion`, `closet`)
      ├── POST /api/daily         ← daily-agent 호출
      ├── POST /api/try-on        ← 로컬 mock try-on, Vertex 연동 전 실험 계약
      ├── POST /api/email         ← 다음날 미션 이메일 발송
      ├── POST /api/dev/gemini    ← 로컬 Gemini smoke test
      └── GET /api/dev/runtime-failures ← runtime incident 조회

[Firebase]
  ├── Auth       ← Google social login
  └── Firestore  ← 유저 프로필, 설문 답변, 피드백 이력

[App Session]
  ├── access token   ← short-lived JWT
  ├── refresh token  ← rotated JWT
  └── session state  ← RTR 검증용 cookie state

[Supabase]
  └── Storage    ← 사진 업로드 (임시 저장, 분석 후 삭제)

[Gemini API]  ← /api/feedback, /api/deep-dive, /api/daily 에서 호출
[Vertex AI Virtual Try-On] ← /api/try-on 의 추후 provider 후보
[Resend]      ← /api/email 에서 호출
```

---

## 데이터 모델 (Firestore)

### users/{userId}
```json
{
  "createdAt": "timestamp",
  "email": "optional",
  "survey": {
    "current_style": "청바지 + 무지 티셔츠",
    "motivation": "소개팅 / 이성 만남",
    "budget": "15~30만원",
    "style_goal": "전체적인 스타일 리셋",
    "confidence_level": "배우는 중"
  },
  "closet_profile": {
    "tops": "무지 티셔츠, 후드티",
    "bottoms": "청바지, 검정 슬랙스",
    "shoes": "흰색 스니커즈",
    "outerwear": "바람막이",
    "avoid": "너무 튀는 색"
  }
}
```

### users/{userId}/feedbacks/{day}
```json
{
  "day": 1,
  "createdAt": "timestamp",
  "diagnosis": "현재 스타일 진단",
  "improvements": ["개선1", "개선2", "개선3"],
  "recommended_outfit": {
    "title": "추천 조합 이름",
    "items": ["상의", "하의", "신발"],
    "reason": "추천 이유",
    "try_on_prompt": "실착 이미지 생성을 위한 짧은 프롬프트"
  },
  "today_action": "오늘 할 것",
  "tomorrow_preview": "내일 미션 예고"
}
```

---

## AI 호출 흐름

```
스타일 프로그램 클라이언트
  → 사진(base64) + 설문 데이터 + 목표/자신감 + 옷장 컨텍스트를 /api/feedback 으로 POST

/api/feedback (Next.js API Route)
  → Supabase Storage에 임시 업로드
  → Gemini API 호출 (이미지 + 설문 + 옷장 컨텍스트 + 피드백 이력)
  → JSON 응답 파싱
  → Firestore에 피드백 저장
  → Supabase Storage에서 이미지 삭제 (개인정보)
  → 클라이언트에 피드백 반환
```

선택형 deep dive는 `/api/deep-dive`를 사용한다.
MVP에서는 `module: "fit"`, `module: "color"`, `module: "occasion"`, `module: "closet"`이 실제 응답을 생성하며, 현재 세션 결과와 사진/옷장 컨텍스트를 함께 넘긴다.
새 deep dive 항목은 API 계약, 테스트, 화면 연결이 모두 준비되기 전까지 완료된 기능처럼 노출하지 않는다.

### 실착 미리보기 흐름

```
스타일 결과 화면 또는 Day 6 상품 후보 화면
  → 사람 전신 사진 + 상품 이미지 + try_on_prompt를 /api/try-on 으로 POST

/api/try-on
  → 로컬 기본값은 mock provider로 동작
  → access token으로 인증된 사용자만 허용
  → 사용자 단위 rate limit 적용
  → TRY_ON_PROVIDER=vertex 일 때 Vertex AI Virtual Try-On REST provider 호출
  → Vertex provider는 서버 전용 VERTEX_* 환경변수가 모두 있을 때만 활성화
  → 생성 이미지도 민감 데이터로 취급하며 기본 영구 저장 금지
```

Vertex AI Virtual Try-On은 Google Cloud 공식 문서 기준 사람 이미지와 상품 이미지를 입력받는 별도 API다. Gemini 피드백 프롬프트의 확장이 아니라 별도 provider로 다룬다.

---

## 유저 세션 관리

- 로그인 시 Firebase popup 인증 후 서버에서 Firebase ID token을 검증하고 자체 JWT 세션 발급
- access token + refresh token 조합 사용
- refresh token은 RTR(refresh token rotation) 방식으로 재발급
- 보호 페이지: `/profile`, `/settings`
- 앱 진입 시 현재 사용자가 새 방문자인지, 진행 중인지, 완료자인지 분기한다
- 재방문 사용자는 같은 onboarding을 반복하지 않고 현재 프로그램 상태로 복귀한다
- 로그인 후 userId와 email은 브라우저 localStorage에 동기화한다
- Firebase client config가 없으면 로컬 개발에선 로그인 세션 bootstrap을 건너뛴다
- 로컬 진단 페이지: `/dev/firebase` 에서 Google 로그인 세션과 Firestore 쓰기 테스트 가능
- 로컬 진단 페이지: `/dev/storage` 에서 Supabase 임시 업로드/삭제 테스트 가능
- 로컬 진단 페이지: `/dev/gemini` 에서 실제 Gemini onboarding 응답 계약 테스트 가능
- 로컬 진단 페이지: `/dev/runtime-failures` 에서 storage runtime failure 누적 상태 확인 가능

---

## 환경 변수

```
AI_PROVIDER=gemini
GOOGLE_API_KEY=
GEMINI_API_KEY=          # legacy alias
GEMINI_REQUEST_TIMEOUT_MS=30000
GEMINI_MAX_RETRIES=0
AUTH_JWT_SECRET=
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=   # optional, analytics only
NEXT_PUBLIC_FIREBASE_USE_EMULATOR=false
NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST=127.0.0.1
NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_PORT=8080
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=
TRY_ON_PROVIDER=mock
VERTEX_TRY_ON_MODEL=virtual-try-on-001
VERTEX_PROJECT_ID=
VERTEX_LOCATION=
VERTEX_ACCESS_TOKEN=
VERTEX_TRY_ON_STORAGE_URI=
RESEND_API_KEY=
```

---

## 제약 및 주의사항

- 사진은 분석 후 즉시 삭제 — Storage에 영구 보관 금지
- Gemini 모델 버전: `gemini-2.5-flash`
- Gemini API 응답 실패 시 재시도 횟수는 `GEMINI_MAX_RETRIES`로 조정한다. 로컬 실험 기본값은 0회, 프로덕션 기본값은 최대 2회다.
- Gemini Vision 호출은 8초를 넘길 수 있으므로 로컬 실험 기본 타임아웃은 `GEMINI_REQUEST_TIMEOUT_MS=30000`으로 둔다.
- 사진 저장 provider는 Supabase Storage 단일 provider로 고정
- 실착 미리보기 provider는 기본 `mock` 이며, Vertex AI 연동은 `TRY_ON_PROVIDER=vertex`, `VERTEX_PROJECT_ID`, `VERTEX_LOCATION`, 인증 토큰(`VERTEX_ACCESS_TOKEN` 또는 로컬 `gcloud auth print-access-token`)이 있을 때 동작한다
- `VERTEX_TRY_ON_STORAGE_URI`는 선택값이다. 설정하면 GCS output 경로를 요청에 포함하고, 설정하지 않으면 inline image bytes 응답을 기대한다
- Vertex Virtual Try-On 기본 모델 ID는 `virtual-try-on-001`이며, 변경이 필요하면 `VERTEX_TRY_ON_MODEL`로 명시한다
- 스타일은 첫 번째 프로그램이며, 앱 전체 진입 구조와 동일시하지 않는다
- Vercel 무료 플랜 함수 실행 시간 제한: 10초 → AI 호출 타임아웃 8초로 설정
- Firebase Spark 플랜 한도 주의 (초기엔 충분, 트래픽 증가 시 Blaze 전환)
