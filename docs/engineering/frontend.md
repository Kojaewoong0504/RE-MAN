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
  /dev
    /firebase           ← 로컬 Firebase 진단 페이지
    /storage            ← 로컬 Supabase Storage 진단 페이지
    /gemini             ← 로컬 Gemini smoke test 페이지
    /runtime-failures   ← storage incident/learned failure 진단 페이지
  /api
    /dev/storage        ← 서버 전용 Storage smoke test route
    /dev/gemini         ← 서버 전용 Gemini smoke test route
    /dev/runtime-failures ← runtime incident 조회 route
    /feedback            ← onboarding-agent 호출
    /daily               ← daily-agent 호출
    /try-on              ← 로컬 mock try-on, Vertex provider 전환 전 UI 계약 검증
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
  /try-on
    TryOnPreview.tsx     ← 상품 이미지 업로드 + 실착 미리보기 작업 영역
  /common
    ProgressBar.tsx      ← 상단 진행 바
    BottomCTA.tsx        ← 하단 고정 CTA 버튼
    FirebaseSessionBootstrap.tsx  ← Google 로그인 세션 sync bootstrap

/lib
  /agents
    gemini.ts            ← Gemini API 호출 함수
  /firebase
    client.ts            ← Firebase client 초기화
    session.ts           ← Google 로그인 세션 함수
    firestore.ts         ← Firestore 유저/피드백 저장
  /supabase
    storage.ts           ← 이미지 업로드/삭제 함수
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
- 밝은 포스터형 배경과 큰 타이포 중심
- CTA 버튼: `bg-accent text-black` 하단 고정
- `/programs` 또는 진행 중 프로그램으로 라우팅

### 설문 (`/onboarding/survey`)
- Q1 → Q2 → Q3 순차 노출, 페이지 전환 아님 (컴포넌트 교체)
- 선택 즉시 다음 질문으로 자동 이동 (버튼 클릭 불필요)
- 완료 시 Zustand `userStore.setSurvey()` 저장
- `/onboarding/upload` 로 라우팅

### 사진 업로드 (`/onboarding/upload`)
- `PhotoUploader`: drag & drop + 파일 선택 둘 다 지원
- 업로드 전 미리보기 표시
- PNG/JPG/WEBP만 허용하고 10MB 초과 파일은 클라이언트에서 먼저 거부한다
- 분석용 이미지는 브라우저에서 1600px 이하 JPEG로 정규화해 Gemini Vision 지연을 줄인다
- "텍스트로 대신하기" 링크 → 텍스트 입력 폼으로 전환
- 목표와 자신감 선택지는 실제 `button`으로 구현한다. 선택 상태가 저장되지 않거나 `/api/feedback` payload에 포함되지 않으면 실패다.
- 사진 또는 텍스트 설명, 옷장 스냅샷, 목표, 자신감이 모두 준비되어야 "AI 분석 시작하기"가 활성화된다
- 업로드 완료 시 이미지 data URL을 보관하고 `/onboarding/analyzing` 이동
- 실제 Supabase 임시 저장은 `/api/feedback`, `/api/daily` 내부에서 수행

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
- 추천 조합은 `FeedbackFlow` 안에만 숨기지 않고 `TryOnPreview` 상단에도 요약으로 노출한다
- 추천 조합 카드 이후 `TryOnPreview` 작업 영역을 노출한다
- 상품 이미지가 없는 사용자를 위해 `TryOnPreview`는 추천 조합 기반 레퍼런스 이미지를 제공한다
- `TRY_ON_PROVIDER=mock` 상태에서는 실제 실착 생성 버튼을 비활성화하고, 레퍼런스 확인까지만 허용한다
- 사용자는 서비스 제공 레퍼런스를 선택하거나 직접 상품 이미지를 올린 뒤 명시적으로 버튼을 눌러야 `/api/try-on`을 호출한다
- 전신 사진 없이 텍스트 설명으로 진행한 경우 try-on은 비활성 안내만 표시한다
- 현재는 mock provider만 사용한다. 실제 Vertex provider는 인증, 레이트리밋, 비용 제한 이후 활성화한다
- 하단 CTA: "Day 1 미션 시작하기" → `/day/1`

---

## 컴포넌트 규칙

- 모든 카드 컴포넌트: `rounded-xl border border-black/10 bg-surface p-5`
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
  body { background: #efe7d8; }
  .container { box-shadow: none; }
}
```

---

## 에러 처리 규칙

- API 실패: 토스트 메시지 (Shadcn `Toast`) — 모달 금지
- 사진 업로드 실패: 인라인 에러 텍스트, 재시도 버튼
- AI 응답 파싱 실패: fallback 메시지 노출 (AGENTS.md 참고)
- 네트워크 오류: "연결이 불안정해요. 잠시 후 다시 시도해주세요."
- Storage 삭제 실패: 서버 재시도 후 incident 대상으로 기록
