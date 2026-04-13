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
| AI | Gemini API (Google) | Vision 지원, 멀티모달 피드백 |
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
      ├── POST /api/daily         ← daily-agent 호출
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

[Gemini API]  ← /api/feedback, /api/daily 에서 호출
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
    "budget": "15~30만원"
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
  "today_action": "오늘 할 것",
  "tomorrow_preview": "내일 미션 예고"
}
```

---

## AI 호출 흐름

```
스타일 프로그램 클라이언트
  → 사진(base64) + 설문 데이터를 /api/feedback 으로 POST

/api/feedback (Next.js API Route)
  → Supabase Storage에 임시 업로드
  → Gemini API 호출 (이미지 + 설문 + 피드백 이력)
  → JSON 응답 파싱
  → Firestore에 피드백 저장
  → Supabase Storage에서 이미지 삭제 (개인정보)
  → 클라이언트에 피드백 반환
```

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
RESEND_API_KEY=
```

---

## 제약 및 주의사항

- 사진은 분석 후 즉시 삭제 — Storage에 영구 보관 금지
- Gemini 모델 버전: `gemini-2.5-flash`
- Gemini API 응답 실패 시 최대 2회 재시도 (AGENTS.md 참고)
- 사진 저장 provider는 Supabase Storage 단일 provider로 고정
- 스타일은 첫 번째 프로그램이며, 앱 전체 진입 구조와 동일시하지 않는다
- Vercel 무료 플랜 함수 실행 시간 제한: 10초 → AI 호출 타임아웃 8초로 설정
- Firebase Spark 플랜 한도 주의 (초기엔 충분, 트래픽 증가 시 Blaze 전환)
