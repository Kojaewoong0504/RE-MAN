# SECURITY.md

## 개요

이 앱은 유저의 얼굴이 포함된 사진을 다룬다.
보안 실패는 신뢰 실패다 — MVP라도 타협하지 않는 영역이 있다.
아래 4가지를 MVP 출시 전 반드시 점검한다.

---

## 1. 사진 데이터 보호

> "유저 사진은 분석 후 즉시 사라져야 한다."

### 규칙
- Supabase Storage 업로드 후 Gemini API 분석 완료 즉시 삭제
- 피드백 결과(텍스트)만 Firestore에 저장 — 사진 URL 저장 금지
- Storage 보관 최대 시간: **5분** (분석 완료 전 타임아웃 기준)
- 삭제 실패와 업로드 실패는 런타임 incident로 기록하고 반복되면 rule promotion 대상으로 승격

### 구현
```typescript
// /api/feedback 흐름
const imageRef = await uploadToStorage(image, userId)
const feedback = await callGemini(image, context)
await deleteFromStorage(imageRef.path)  // 분석 직후 즉시 삭제
await saveFeedbackToFirestore(userId, feedback)
```

### Storage 접근 정책 (Supabase)
```
bucket: private
path: uploads/{userId}/{randomFileName}
upload: server-side signed upload 또는 service-role 경유
delete: Gemini 분석 직후 서버에서 즉시 삭제
public URL: 금지
```

### 하네스 고정 규칙
- `app/api/feedback/route.ts`, `app/api/daily/route.ts` 는 직접 Storage를 다루지 않고 `withTemporaryStoredImage(...)` 경유
- 삭제는 `lib/supabase/temp-image.ts` 의 `finally` 블록에서 수행
- upload/delete 장애는 `harness/reports/runtime-incidents.json` 과 `runtime-learned-failures.json` 에 누적

---

## 2. API 키 보호

> "클라이언트에 키가 노출되는 순간 전액 과금될 수 있다."

### 규칙
- Gemini API 키: **서버사이드 전용** — Next.js API Route에서만 호출
- Firebase 클라이언트 키: 공개 가능하나 Security Rules로 접근 제한
- Firebase Admin SDK 키: **서버사이드 전용** — 절대 클라이언트 번들에 포함 금지
- Supabase `anon` 키: 공개 가능하나 버킷 정책으로 접근 제한
- Supabase `service_role` 키: **서버사이드 전용**

### 환경 변수 관리
```bash
# .env.local (절대 커밋 금지)
GEMINI_API_KEY=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=
SUPABASE_SERVICE_ROLE_KEY=

# 클라이언트에서 접근 가능한 변수만 NEXT_PUBLIC_ prefix 사용
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

### 체크리스트
- [ ] `.env.local` `.gitignore`에 포함 확인
- [ ] Vercel 환경 변수에 서버 키 등록
- [ ] `NEXT_PUBLIC_` 변수에 민감한 키 없는지 확인
- [ ] GitHub 레포 public 설정 시 시크릿 스캔 활성화

---

## 3. 업로드 악용 방지

> "사진 업로드 엔드포인트는 공격 표면이다."

### 규칙
- 허용 파일 타입: `image/jpeg`, `image/png`, `image/webp` 만
- 최대 파일 크기: **10MB**
- 파일명 랜덤 생성 — 유저 입력 파일명 사용 금지

### 구현
```typescript
// /api/feedback 업로드 검증
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 10 * 1024 * 1024  // 10MB

function validateUpload(file: File) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('이미지 파일만 업로드 가능해요.')
  }
  if (file.size > MAX_SIZE) {
    throw new Error('10MB 이하 파일만 업로드 가능해요.')
  }
}

// 파일명 랜덤 생성
const filename = `${userId}/${crypto.randomUUID()}.jpg`
```

### Rate Limiting
- 동일 userId당 API 호출: **분당 5회** 제한
- Vercel Edge Middleware 또는 Upstash Redis로 구현
- 초과 시 응답: `429 Too Many Requests`
- Supabase Storage 버킷은 `private` 유지, 공개 버킷 금지
- 서버 업로드 전 MIME/type 검증과 10MB 크기 검증 수행

---

## 4. 인증 우회 방지 (Anonymous Auth 악용)

> "익명 인증이 무제한 API 호출의 통로가 되어선 안 된다."

### 규칙
- Anonymous userId당 피드백 생성 최대 **7회** (Day 1~7)
- Firestore에서 userId별 호출 횟수 카운팅
- 7회 초과 시 추가 피드백 생성 차단

### Firestore 보안 규칙
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 유저는 본인 데이터만 읽기/쓰기
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
    // 피드백은 본인 것만 접근, 최대 7개
    match /users/{userId}/feedbacks/{day} {
      allow read: if request.auth.uid == userId;
      allow write: if request.auth.uid == userId
                   && int(day) >= 1
                   && int(day) <= 7;
    }
  }
}
```

저장소 기준 파일: `firebase/firestore.rules`

---

## MVP 출시 전 보안 체크리스트

### 필수 (출시 전 반드시)
- [ ] 사진 분석 후 Storage 자동 삭제 동작 확인
- [ ] API 키 `.env.local`에만 존재, 커밋 이력 없음 확인
- [ ] 파일 타입/크기 검증 동작 확인
- [ ] Firebase Security Rules 배포 확인
- [ ] Supabase Storage 버킷이 private 인지 확인
- [ ] Rate Limiting 동작 확인

### 권장 (출시 후 빠르게)
- [ ] Vercel Analytics로 비정상 트래픽 모니터링
- [ ] Firebase 사용량 알림 설정 (비용 급증 감지)
- [ ] HTTPS 강제 리다이렉트 확인
