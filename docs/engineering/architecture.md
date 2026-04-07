# ARCHITECTURE.md

## 개요

웹앱 기준 MVP 아키텍처.
빠른 배포와 최소 인프라 운영이 목표 — 복잡한 백엔드 없이 시작한다.

---

## 기술 스택

| 영역 | 기술 | 이유 |
|---|---|---|
| 프론트엔드 | Next.js (React) | App Router 기반 SSR, API Route 내장 |
| 배포 | Vercel | Next.js 최적화, 무중단 배포 |
| 데이터베이스 | Firebase Firestore | 실시간 DB, 인증 통합, 빠른 세팅 |
| AI | Gemini API (Google) | Vision 지원, 멀티모달 피드백 |
| 사진 업로드 | Firebase Storage | Firestore와 동일 프로젝트 관리 |
| 이메일 발송 | Resend | 간단한 API, Next.js 친화적 |

---

## 시스템 구조

```
[유저 브라우저]
      ↓ HTTP
[Next.js App - Vercel]
  ├── /app (페이지 라우팅)
  │   ├── / (랜딩)
  │   ├── /onboarding (설문 + 사진 업로드)
  │   ├── /result (AI 피드백 결과)
  │   └── /day/[n] (Day 2~7 미션)
  │
  └── /app/api (서버사이드 API Routes)
      ├── POST /api/feedback      ← onboarding-agent 호출
      ├── POST /api/daily         ← daily-agent 호출
      └── POST /api/email         ← 다음날 미션 이메일 발송

[Firebase]
  ├── Firestore  ← 유저 세션, 설문 답변, 피드백 이력
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
클라이언트
  → 사진을 Firebase Storage에 업로드
  → Storage URL + 설문 데이터를 /api/feedback 으로 POST

/api/feedback (Next.js API Route)
  → Firebase Storage에서 이미지 읽기
  → Gemini API 호출 (이미지 + 설문 + 피드백 이력)
  → JSON 응답 파싱
  → Firestore에 피드백 저장
  → Firebase Storage에서 이미지 삭제 (개인정보)
  → 클라이언트에 피드백 반환
```

---

## 유저 세션 관리

- 회원가입 없이 시작 → Firebase Anonymous Auth로 임시 userId 발급
- 이메일 입력 시 → Anonymous 계정에 이메일 연결
- userId는 브라우저 localStorage에 유지

---

## 환경 변수

```
GEMINI_API_KEY=
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
RESEND_API_KEY=
```

---

## 제약 및 주의사항

- 사진은 분석 후 즉시 삭제 — Storage에 영구 보관 금지
- Gemini API 응답 실패 시 최대 2회 재시도 (AGENTS.md 참고)
- Vercel 무료 플랜 함수 실행 시간 제한: 10초 → AI 호출 타임아웃 8초로 설정
- Firebase Spark 플랜 한도 주의 (초기엔 충분, 트래픽 증가 시 Blaze 전환)
