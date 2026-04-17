# RELIABILITY.md

## 개요

이 앱의 핵심 가치는 "사진 올리면 바로 피드백"이다.
이 흐름이 끊기는 순간 유저는 떠난다.
MVP라도 두 가지 장애만큼은 반드시 버텨야 한다.

---

## 핵심 장애 시나리오

### 시나리오 1 — Gemini API 응답 지연/실패

가장 두려운 시나리오. AI가 없으면 이 앱은 아무것도 아니다.

**원인:**
- Gemini API 서버 과부하 또는 일시 장애
- 응답 시간 초과 (Vercel 함수 10초 제한)
- 잘못된 응답 포맷 반환

**대응 전략:**

| 상황 | 대응 |
|---|---|
| 응답 지연 (5초 이상) | 로딩 화면 유지, 텍스트 애니메이션 계속 |
| 응답 실패 1~2회 | 자동 재시도 (최대 2회, 2초 간격) |
| 재시도 후도 실패 | Fallback 메시지 노출 + 텍스트 대체 옵션 안내 |
| 포맷 불일치 | 파싱 실패로 처리, 재시도 1회 |

**구현:**
```typescript
async function callGeminiWithRetry(payload: GeminiPayload, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await Promise.race([
        callGemini(payload),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 8000)  // 8초 타임아웃
        )
      ])
      return validateGeminiResponse(response)  // 포맷 검증
    } catch (error) {
      if (attempt === maxRetries) throw error
      await sleep(2000)  // 2초 후 재시도
    }
  }
}
```

**Fallback 메시지 (AGENTS.md 참고):**
> "지금 사진 분석이 잠깐 어려운 상황이에요.
> 오늘 입은 옷을 간단히 텍스트로 설명해주시면 바로 피드백 드릴게요."

---

### 시나리오 2 — 사진 업로드 실패

**원인:**
- 네트워크 불안정
- Supabase Storage 일시 장애
- 파일 크기/형식 문제 (→ SECURITY.md에서 사전 차단)

**대응 전략:**

| 상황 | 대응 |
|---|---|
| 네트워크 오류 | 인라인 에러 + "다시 시도하기" 버튼 |
| Storage 장애 | 에러 메시지 + 텍스트 대체 옵션 안내 |
| 업로드 중 이탈 | 업로드 상태 유지 (페이지 이탈 경고 없음, 재시도 허용) |

추가 규칙:
- upload/delete 장애는 fallback UI로 끝내지 않고 runtime incident로 기록
- 같은 signature가 2회 이상 반복되면 harness 승격 후보로 간주

**구현:**
```typescript
async function uploadWithRetry(file: File, userId: string, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await uploadToSupabaseStorage(file, userId)
    } catch (error) {
      if (attempt === maxRetries) {
        // 최종 실패 시 텍스트 대체 모드로 전환 안내
        throw new UploadFailedError('업로드에 실패했어요. 텍스트로 대신 설명해주세요.')
      }
      await sleep(1500)
    }
  }
}
```

---

## 모니터링

### 1. SLA 목표

| 지표 | 목표 |
|---|---|
| 서비스 Uptime | 99% 이상 (월 7시간 이하 장애) |
| AI 피드백 성공률 | 95% 이상 |
| 사진 업로드 성공률 | 97% 이상 |
| AI 응답 시간 (p95) | 8초 이하 |

> MVP 초기엔 목표 미달이어도 추적이 목적 — 추이를 보며 개선한다.

---

### 2. 에러 로깅 (Sentry)

```typescript
// Next.js API Route 에러 캡처
import * as Sentry from '@sentry/nextjs'

try {
  const feedback = await callGeminiWithRetry(payload)
} catch (error) {
  Sentry.captureException(error, {
    tags: { feature: 'gemini-feedback', userId },
    extra: { day: currentDay, hasImage: !!image }
  })
  return res.status(500).json({ error: 'feedback_failed' })
}
```

**캡처 대상:**
- Gemini API 호출 실패 (재시도 모두 소진 시)
- Supabase Storage 업로드 실패
- 피드백 JSON 파싱 실패
- Vercel 함수 타임아웃

---

### 3. 장애 감지 알림

**Vercel + Sentry 연동으로 자동 알림:**

| 트리거 | 알림 채널 |
|---|---|
| 동일 에러 5분 내 3회 이상 | 이메일 |
| Gemini API 연속 실패 | 이메일 |
| Vercel 배포 실패 | 이메일 |
| Firebase 사용량 80% 초과 | 이메일 (Firebase 콘솔 설정) |

---

## 장애 대응 플레이북

### Gemini API 전면 장애 시
1. 상태 페이지 확인: https://status.cloud.google.com
2. 피드백 API 엔드포인트 임시 비활성화
3. 모든 피드백 요청에 Fallback 텍스트 반환
4. 복구 후 피드백 재시도 안내 이메일 발송 (이메일 수집된 유저 대상)

### 로컬 Gemini Vision 타임아웃
1. 증상: `/api/feedback` 이 약 30초 후 500으로 끝나고 로그에 `This operation was aborted` 가 나온다.
2. 원인: 사진 분석은 텍스트 smoke test보다 오래 걸릴 수 있으며, 짧은 타임아웃 + 재시도 조합이 실패 시간을 늘린다.
3. 로컬 권장값: `GEMINI_REQUEST_TIMEOUT_MS=30000`, `GEMINI_MAX_RETRIES=0`
4. 먼저 `/api/dev/gemini` POST smoke test로 키와 기본 모델 응답을 확인한다.
5. 실제 사진 분석 API 검증은 `npm run smoke:feedback:gemini`로 확인한다. mock E2E 통과를 실제 Gemini 검증으로 간주하지 않는다.
6. 실제 브라우저 업로드 경로 검증은 같은 로컬 서버에서 `npm run smoke:feedback:browser`로 확인한다.

### Supabase Storage 장애 시
1. 상태 페이지 확인: https://status.supabase.com
2. 신규 사진 업로드 일시 중단 (텍스트 대체 모드 우선 안내)
3. 기존 유저 Day 진행은 Firestore + 로컬 캐시로 유지

---

## MVP 출시 전 신뢰성 체크리스트

- [ ] Gemini 재시도 로직 동작 확인 (강제 오류 주입 테스트)
- [ ] 사진 업로드 실패 시 Fallback UI 노출 확인
- [ ] upload/delete 장애가 `runtime-incidents.json` 과 `runtime-learned-failures.json` 에 기록되는지 확인
- [ ] `runtime-incidents.json` 은 최근 50개만 보관하고, 반복 횟수는 `runtime-learned-failures.json` 에 누적되는지 확인
- [ ] Sentry 연동 및 에러 캡처 동작 확인
- [ ] Firebase 사용량 알림 설정 완료
- [ ] Vercel 배포 실패 알림 설정 완료
- [ ] 8초 타임아웃 동작 확인
