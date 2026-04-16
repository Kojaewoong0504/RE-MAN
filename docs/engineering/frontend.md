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
    /result              ← Style Check Session 결과
  /day
    /[n]                 ← 선택형 Routine Mode legacy 페이지
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
    /deep-dive           ← 선택형 deep dive 호출 (`fit`, `color`, `occasion`, `closet`)
    /daily               ← 선택형 Routine Mode daily-agent 호출
    /try-on              ← 로컬 mock try-on, Vertex provider 전환 전 UI 계약 검증
    /email               ← 이메일 발송

/components
  /common
    BottomTabNav.tsx     ← 모바일 웹앱 하단 탭 내비게이션
    BottomCTA.tsx        ← 하단 탭 위에 뜨는 주요 CTA
    FirebaseSessionBootstrap.tsx  ← Google 로그인 세션 sync bootstrap
  /closet
    ClosetInventoryEditor.tsx ← 현실 옷장 사진 등록/삭제/요약 작업면
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

### 공통 앱 내비게이션
- 모바일 웹앱의 기본 이동은 `BottomTabNav`가 담당한다.
- 기본 탭은 홈(`/`), 스타일(`/programs/style`), 옷장(`/closet`), 기록(`/history`), 내 정보(`/profile`) 5개다.
- 보호된 탭은 비로그인 상태에서 해당 페이지 middleware가 로그인으로 보낸다. 탭 컴포넌트가 임의로 인증 상태를 추측해 링크를 숨기면 안 된다.
- `/login`, `/dev/*`, 분석 대기 화면처럼 집중이 필요한 화면에서는 하단 탭을 숨긴다.
- `BottomCTA`가 있는 화면에서는 CTA가 하단 탭과 겹치지 않아야 한다.

### 랜딩 (`/`)
- 홈은 최근 기록 페이지가 아니라 앱 기능 허브다.
- 추천, 이벤트, 스타일 체크, 옷장처럼 제공 기능으로 바로 이동하는 작은 아이콘/타일 집합을 우선 배치한다.
- 최근 결과, 최근 기록, 긴 프로그램 요약은 홈에 노출하지 않는다. 기록 상세는 `/history`에서만 확인한다.
- 기본 CTA는 스타일 체크 시작이며, 진행 상태에 따라 홈 문구가 크게 흔들리면 실패다.

### 설문 (`/onboarding/survey`)
- Q1 → Q2 → Q3 순차 노출, 페이지 전환 아님 (컴포넌트 교체)
- 선택 즉시 다음 질문으로 자동 이동 (버튼 클릭 불필요)
- 완료 시 Zustand `userStore.setSurvey()` 저장
- `/onboarding/upload` 로 라우팅

### 사진 업로드 (`/onboarding/upload`)
- `PhotoUploader`: drag & drop + 파일 선택 둘 다 지원
- 업로드 전 미리보기 표시
- PNG/JPG/WEBP만 허용하고 10MB 초과 파일은 클라이언트에서 먼저 거부한다
- 사진 파일이 비어 있거나 브라우저에서 읽히지 않으면 인라인 에러를 표시하고 분석 payload에 포함하지 않는다
- 텍스트 대체 입력은 최소 설명 길이를 만족해야 CTA가 활성화된다
- 분석용 이미지는 브라우저에서 1600px 이하 JPEG로 정규화해 Gemini Vision 지연을 줄인다
- "텍스트로 대신하기" 링크 → 텍스트 입력 폼으로 전환
- 목표와 자신감 선택지는 실제 `button`으로 구현한다. 선택 상태가 저장되지 않거나 `/api/feedback` payload에 포함되지 않으면 실패다.
- 사진 또는 텍스트 설명, 옷장 스냅샷이 준비되어야 "AI 분석 시작하기"가 활성화된다
- 목표/자신감은 기본값을 저장하고, 사용자가 원할 때 보조 설정에서 수정한다
- 사이즈 정보는 업로드 기본 화면에 펼치지 않고 보조 설정 안에 둔다
- 옷장 입력은 현실 옷장 사진 등록을 기본으로 한다. 상의/하의/신발/겉옷 중 최소 1개 사진 아이템이 있어야 분석을 시작할 수 있다
- 등록된 옷장 사진 아이템은 `/api/feedback` 요청 전에 카테고리별 `closet_profile` 요약으로 변환되어 payload에 포함되어야 한다. 사진 원본은 payload에서 제외한다
- `/onboarding/upload?reset=photo`로 진입하면 설문/옷장 기준과 compact 피드백 히스토리는 유지하되 이전 이미지, 현재 피드백, deep-dive, try-on 캐시는 초기화한다. 새 사진 체크가 이전 분석 산출물과 섞이면 실패다
- 새 분석을 시작할 때도 이전 deep-dive, try-on 캐시, 루틴 산출물은 비워야 한다. 단, `feedback_history`는 다음 분석의 개인화 컨텍스트로 payload에 포함한다
- 업로드 완료 시 이미지 data URL을 보관하고 `/onboarding/analyzing` 이동
- 실제 Supabase 임시 저장은 `/api/feedback`, `/api/daily` 내부에서 수행

### 로딩 (`/onboarding/analyzing`)
- `/api/feedback` 호출 시작
- 텍스트 3단계 순차 표시 (1.5초 간격):
  1. "핏을 분석하는 중..."
  2. "컬러 밸런스 확인 중..."
  3. "개선 포인트 정리 중..."
- API 응답 오면 즉시 `/onboarding/result` 이동
- `429 rate_limited` 응답은 일반 분석 실패가 아니라 과도한 반복 요청으로 안내하고, `Retry-After` 기준 재시도 가능 시간을 표시한다

### 피드백 결과 (`/onboarding/result`)
- 진단, 개선 포인트, 추천 조합, 다음 행동을 한 화면에서 스캔 가능하게 노출한다
- AI 응답은 UI 저장 전 `normalize*Response` 계열 함수로 길이를 제한한다. 긴 문장을 그대로 카드에 렌더링해 모바일 가시성을 떨어뜨리면 실패다
- 화면 본문은 짧게 쓴다. 제목/라벨을 제외한 설명문은 기본 1문장, 45자 안팎을 목표로 한다.
- AI 응답처럼 긴 텍스트는 카드에서 그대로 펼치지 않는다. 요약, 토글, 또는 별도 상세 화면으로 분리한다.
- 결과 화면은 MVP 핵심 결과만 보여준다. deep-dive, try-on, credits는 노출하지 않는다.
- 사이즈 후보와 내부 기준 후보는 사용자가 직접 입력한 평소 사이즈 기반일 때만 `사이즈 체크 후보`로 노출한다. 구매 버튼, 가격, 외부 상품 링크처럼 보이면 실패다.
- 사이즈 정보가 없으면 섹션을 숨기지 말고 `사이즈 추가하기`를 `/settings#size-profile`로 연결한다.
- 결과 화면에서 서버 호출을 만드는 보조 기능 버튼을 여러 개 두지 않는다. 대기 중 사용자가 다른 생성성 기능을 누를 수 있으면 실패다.
- 추천 조합 카드 이후에는 옷장 근거, 사이즈 체크 후보, 저장/피드백/옷장 수정/기록 보기/새 체크만 남긴다.
- `/closet`, `/history`, `/profile`처럼 핵심 기능은 하단 탭 또는 최소 액션 레일에서 접근 가능해야 한다.
- try-on, credits, deep-dive는 백엔드 계약과 테스트가 남아 있더라도 MVP 프론트 기본 화면에서는 숨긴다. 다시 노출하려면 별도 문서 승인과 대기/중복요청 제어가 먼저 필요하다.
- 하단 CTA: "홈으로" → `/`
- 계정 저장은 자동 저장으로 숨기지 않고 결과 화면의 명시적 액션으로 제공한다. 로그인 상태에서는 현재 결과와 추천 반응을 계정에 붙일 수 있어야 하고, 비로그인 상태에서는 로그인 CTA를 보여준다.

### 프로필 (`/profile`)
- 프로필은 계정/설정/데이터 관리 런처다. 최근 결과 상세나 긴 타임라인을 렌더링하지 않는다.
- 문장은 최소화한다. 이름, 이메일, 로그인 제공자, 선호 프로그램, 짧은 상태만 보여준다.
- 기록 상세는 `/history`, 옷장 관리는 `/closet`, 기준 수정은 `/settings`로 분리한다.
- 새 사진 체크 액션은 `/programs/style/onboarding/upload?reset=photo`로 진입해야 한다.
- 프로필에서 최근 기록 카드, Saved Feedback 타임라인, Deep Dive 상세를 다시 노출하면 실패다.

### 설정 (`/settings`)
- 설정은 계정 정보, 코칭 기준, 평소 사이즈, 피하고 싶은 스타일을 수정하는 화면이다.
- 현실 옷장 사진 등록/삭제/카테고리 편집은 `/closet` 전용 화면에서만 한다.
- 설정 화면에 전체 `ClosetInventoryEditor`를 중복 노출하지 않는다. 설정에서는 옷장 개수 요약과 `/closet` 이동 링크만 제공한다.
- `#size-profile`로 진입하면 평소 사이즈 입력 영역이 시각적으로 강조되어야 한다.
- 사용자가 설정 폼을 편집하기 시작한 뒤 늦게 도착한 원격 프로필은 현재 입력값을 덮어쓰면 안 된다.

### 기록 (`/history`)
- 원격 기록 로드 실패를 기본 화면의 빨간 오류 카드로 반복 노출하지 않는다. 로컬 기록 fallback을 우선 보여준다.
- 기록은 일별, 주별, 월별 탭으로 전환 가능해야 한다.
- 기록 아이템은 단순 문장 리스트가 아니라 클릭 가능한 카드로 구현한다.
- 카드 기본 상태는 유형, 제목, 짧은 요약만 보여주고, 클릭 시 행동/진단/이동 액션을 펼친다.
- 긴 기록 텍스트를 한 페이지에 그대로 펼치면 실패다.

### 옷장 (`/closet`)
- 옷장은 텍스트 목록이 아니라 현실 옷장 사진을 저장하는 작업면이다.
- 기본 화면은 사진 업로드 폼이 아니라 실제 옷장처럼 보이는 compact inventory다.
- 옷장 컴포넌트는 외곽 프레임, 행거 레일, 선반/서랍/신발 칸의 시각 구획을 가져야 한다.
- 상의/하의/신발/겉옷은 선반 또는 서랍 단위로 묶고, 각 아이템은 사진 썸네일 중심으로 보여준다.
- 상의/하의/신발/겉옷 칸은 기본 닫힘이며, 사용자가 칸을 클릭해야 내부 아이템을 펼친다.
- 사진 업로드와 미리보기 폼은 `+` 추가 모달 안에서만 열린다.
- `+` 추가 버튼은 통합 버튼 하나만 둔다. 카테고리별 추가 버튼을 반복 노출하지 않는다.
- 카테고리/이름/색/사이즈/메모는 추천 payload를 위한 보조 설명으로 둔다.
- `Avoid` 같은 영어 내부 필드명은 옷장 화면에 노출하지 않는다. 피하고 싶은 스타일 입력은 설정 또는 분석 전 입력에서만 한국어로 제공한다.
- 옷장 사진을 `/api/feedback`의 분석 이미지로 함께 보내지 않는다. 현재 분석 이미지는 유저의 현재 전신 사진 1장만 허용한다.
- 사용자가 사진을 등록하지 않은 새 옷장 아이템을 추가할 수 있으면 실패다. 단, 과거 legacy 텍스트 아이템은 읽기/수정 호환을 유지한다.

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
