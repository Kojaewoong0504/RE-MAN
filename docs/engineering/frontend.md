# FRONTEND.md

## 개요

Next.js App Router 기반 프론트엔드 구성 상세.
DESIGN.md의 비주얼 원칙을 코드 레벨로 구현하는 방법을 정의한다.

---

## 기술 스택

| 영역 | 기술 |
|---|---|
| 프레임워크 | Next.js 14 (App Router) |
| 스타일링 | Tailwind CSS + Shadcn/ui |
| 상태 관리 | Zustand |
| 폼 | React Hook Form |
| 애니메이션 | Framer Motion (최소한으로) |
| 아이콘 | Lucide React |
| 폰트 | Pretendard (next/font) |

---

## 디렉토리 구조

```
/app
  /                      ← 랜딩 페이지
  /onboarding
    /survey              ← 설문 (Q1~Q3)
    /upload              ← 사진 업로드
    /analyzing           ← AI 분석 중 로딩
    /result              ← 첫 AI 피드백
  /day
    /[n]                 ← Day 2~7 미션 페이지
  /api
    /feedback            ← onboarding-agent 호출
    /daily               ← daily-agent 호출
    /email               ← 이메일 발송

/components
  /ui                    ← Shadcn 기본 컴포넌트
  /feedback
    FeedbackCard.tsx     ← 피드백 카드 단위 컴포넌트
    FeedbackFlow.tsx     ← 카드 순차 노출 컨트롤러
  /survey
    SurveyStep.tsx       ← 설문 단계 컴포넌트
    OptionButton.tsx     ← 선택지 버튼
  /upload
    PhotoUploader.tsx    ← 사진 업로드 영역
    UploadGuide.tsx      ← 가이드 예시 이미지
  /common
    ProgressBar.tsx      ← 상단 진행 바
    BottomCTA.tsx        ← 하단 고정 CTA 버튼

/store
  userStore.ts           ← 유저 세션, 설문 답변
  feedbackStore.ts       ← 피드백 이력

/lib
  gemini.ts              ← Gemini API 호출 함수
  firebase.ts            ← Firebase 초기화 및 유틸
  upload.ts              ← 사진 업로드/삭제 함수
```

---

## 상태 관리 (Zustand)

### userStore
```typescript
interface UserStore {
  userId: string | null
  survey: {
    current_style: string
    motivation: string
    budget: string
  } | null
  email: string | null
  setUserId: (id: string) => void
  setSurvey: (survey: UserStore['survey']) => void
  setEmail: (email: string) => void
}
```

### feedbackStore
```typescript
interface FeedbackStore {
  history: Feedback[]        // Day별 피드백 이력
  currentDay: number         // 현재 진행 중인 Day
  addFeedback: (feedback: Feedback) => void
  getCurrentFeedback: () => Feedback | null
}
```

---

## 페이지별 구현 상세

### 랜딩 (`/`)
- 풀스크린 레이아웃, 스크롤 없음
- 헤드카피 `text-5xl font-bold` 중앙 정렬
- CTA 버튼: `bg-[#F5F500] text-black` 하단 고정
- `/onboarding/survey` 로 라우팅

### 설문 (`/onboarding/survey`)
- Q1 → Q2 → Q3 순차 노출, 페이지 전환 아님 (컴포넌트 교체)
- 선택 즉시 다음 질문으로 자동 이동 (버튼 클릭 불필요)
- 완료 시 Zustand `userStore.setSurvey()` 저장
- `/onboarding/upload` 로 라우팅

### 사진 업로드 (`/onboarding/upload`)
- `PhotoUploader`: drag & drop + 파일 선택 둘 다 지원
- 업로드 전 미리보기 표시
- "텍스트로 대신하기" 링크 → 텍스트 입력 폼으로 전환
- 업로드 완료 시 Firebase Storage에 저장 후 `/onboarding/analyzing` 이동

### 로딩 (`/onboarding/analyzing`)
- `/api/feedback` 호출 시작
- 텍스트 3단계 순차 표시 (1.5초 간격):
  1. "핏을 분석하는 중..."
  2. "컬러 밸런스 확인 중..."
  3. "개선 포인트 정리 중..."
- API 응답 오면 즉시 `/onboarding/result` 이동

### 피드백 결과 (`/onboarding/result`)
- `FeedbackFlow` 컴포넌트가 카드 순차 노출 관리
- 카드 전환: 좌→우 슬라이드 (Framer Motion)
- 마지막 카드 배경: `bg-[#F5F500]`, 텍스트: `text-black`
- 하단 CTA: "Day 1 미션 시작하기" → `/day/1`

---

## 컴포넌트 규칙

- 모든 카드 컴포넌트: `rounded-xl bg-[#1E1E1E] p-5`
- CTA 버튼 최소 높이: `h-14` (56px) — 엄지 터치 대응
- 텍스트 입력 필드: Shadcn `Input` 컴포넌트 사용, 커스텀 금지
- 로딩 스피너: 사용 금지 — 텍스트 애니메이션으로 대체

---

## 모바일 대응

```css
/* 기본: 모바일 (max 480px) */
.container { max-width: 480px; margin: 0 auto; }

/* 데스크탑: 중앙 정렬, 앱처럼 보이게 */
@media (min-width: 768px) {
  body { background: #0a0a0a; }
  .container { box-shadow: 0 0 40px rgba(0,0,0,0.5); }
}
```

---

## 에러 처리 규칙

- API 실패: 토스트 메시지 (Shadcn `Toast`) — 모달 금지
- 사진 업로드 실패: 인라인 에러 텍스트, 재시도 버튼
- AI 응답 파싱 실패: fallback 메시지 노출 (AGENTS.md 참고)
- 네트워크 오류: "연결이 불안정해요. 잠시 후 다시 시도해주세요."
