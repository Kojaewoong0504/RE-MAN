# Body-Aware Safe Recommendation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 체형/비율 보정 신호를 추천 계약과 추천 엔진에 반영해, 현재 옷장 기준의 안전한 기본 추천과 짧은 실패 회피 설명을 반환한다.

**Architecture:** 기존 `buildHybridRecommendation()` 흐름을 유지하되, 사진 기반 `body_profile`과 failure-avoidance layer를 추가한다. `/api/feedback`는 provider 응답을 그대로 쓰지 않고 body-aware recommendation composer를 거친 구조화 결과만 반환하며, 결과 화면은 장문 설명 대신 `안전한 이유`, `피해야 할 것`, `오늘 행동` 중심으로 압축한다.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, Playwright, existing Gemini/mock feedback pipeline

---

## File Structure

### Create

- `lib/agents/body-profile.ts`
  - 사진/텍스트 기반 추천용 체형 신호 타입과 normalize 로직 정의
- `lib/product/body-aware-recommendation.ts`
  - failure-avoidance rules + closet scoring + safe recommendation composition 담당
- `tests/unit/body-profile.test.ts`
  - body profile normalize/validation 테스트
- `tests/unit/body-aware-recommendation.test.ts`
  - 실패 회피 규칙과 안전 추천 조합 테스트

### Modify

- `lib/agents/contracts.ts`
  - `BodyProfile`, `SafetyBasis`, `AvoidNotes` 등 계약 타입 추가
- `lib/agents/mock-feedback.ts`
  - mock provider 응답이 새 계약을 따르도록 수정
- `lib/agents/gemini.ts`
  - onboarding prompt/response sanitize가 새 body-aware 출력 구조를 지원하도록 수정
- `lib/product/recommendation-mix.ts`
  - body-aware recommendation composer를 호출하도록 정리
- `app/api/feedback/route.ts`
  - `body_profile`을 포함한 최종 응답 조합
- `app/onboarding/analyzing/page.tsx`
  - `/api/feedback` payload에 body profile 입력 포함
- `app/onboarding/result/page.tsx`
  - 한 줄 진단 / 안전한 이유 / 피해야 할 것 / 오늘 행동 UI 반영
- `app/globals.css`
  - 새 결과 요약 UI 스타일
- `tests/unit/recommendation-mix.test.ts`
  - body-aware mix 기본 경로 테스트 추가
- `tests/integration/feedback-route.test.ts`
  - route가 body-aware 구조를 반환하는지 검증
- `tests/e2e/onboarding.spec.ts`
  - 결과 화면이 새 UX 규칙을 지키는지 검증
- `AGENTS.md`
  - body-aware recommendation 검증 규칙 추가

---

### Task 1: Add body-aware contracts and normalization

**Files:**
- Create: `lib/agents/body-profile.ts`
- Modify: `lib/agents/contracts.ts`
- Test: `tests/unit/body-profile.test.ts`

- [ ] **Step 1: Write the failing contract test**

```ts
import { describe, expect, it } from "vitest";
import { normalizeBodyProfile } from "@/lib/agents/body-profile";

describe("body profile normalization", () => {
  it("keeps only supported qualitative fields and risk tags", () => {
    expect(
      normalizeBodyProfile({
        upper_body_presence: "high",
        belly_visibility: "high",
        leg_length_impression: "shorter",
        fit_risk_tags: ["tight_top_risk", "unknown_tag"]
      })
    ).toEqual({
      upper_body_presence: "high",
      belly_visibility: "high",
      leg_length_impression: "shorter",
      fit_risk_tags: ["tight_top_risk"]
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `~/.nvm/versions/node/v22.19.0/bin/npx vitest run tests/unit/body-profile.test.ts`

Expected: FAIL with `Cannot find module '@/lib/agents/body-profile'`

- [ ] **Step 3: Add contract types to `lib/agents/contracts.ts`**

```ts
export type BodyProfileSignalLevel = "low" | "medium" | "high";
export type BodyProfileLegImpression = "shorter" | "balanced" | "longer";
export type BodyProfileShoulderShape = "rounded" | "narrow" | "balanced";
export type BodyProfileNeckImpression = "short" | "balanced" | "long";
export type BodyProfileFrame = "large" | "medium" | "compact";

export type BodyFitRiskTag =
  | "tight_top_risk"
  | "cropped_top_risk"
  | "strong_contrast_split_risk"
  | "skinny_bottom_risk"
  | "heavy_neckline_risk";

export type BodyProfile = {
  upper_body_presence?: BodyProfileSignalLevel;
  lower_body_balance?: BodyProfileSignalLevel;
  belly_visibility?: BodyProfileSignalLevel;
  leg_length_impression?: BodyProfileLegImpression;
  shoulder_shape?: BodyProfileShoulderShape;
  neck_impression?: BodyProfileNeckImpression;
  overall_frame?: BodyProfileFrame;
  fit_risk_tags?: BodyFitRiskTag[];
};

export type OutfitRecommendation = {
  title: string;
  items: [string, string, string];
  reason: string;
  safety_basis?: [string, string, string];
  avoid_notes?: [string, string, string];
  try_on_prompt: string;
  source_item_ids?: Partial<Record<AgentClosetItemCategory, string>>;
};

export type AgentRequest = {
  user_id?: string;
  image?: string;
  text_description?: string;
  survey: SurveyInput;
  body_profile?: BodyProfile;
  closet_profile?: ClosetProfile;
  closet_items?: AgentClosetItem[];
  closet_strategy?: ClosetStrategy;
  feedback_history: FeedbackHistoryItem[];
  preference_profile?: PreferenceProfile;
};
```

- [ ] **Step 4: Create `lib/agents/body-profile.ts` with normalize helpers**

```ts
import type { BodyFitRiskTag, BodyProfile } from "@/lib/agents/contracts";

const BODY_RISK_TAGS: BodyFitRiskTag[] = [
  "tight_top_risk",
  "cropped_top_risk",
  "strong_contrast_split_risk",
  "skinny_bottom_risk",
  "heavy_neckline_risk"
];

export function normalizeBodyProfile(value: unknown): BodyProfile | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const raw = value as Record<string, unknown>;
  const fitRiskTags = Array.isArray(raw.fit_risk_tags)
    ? raw.fit_risk_tags.filter((item): item is BodyFitRiskTag =>
        typeof item === "string" && BODY_RISK_TAGS.includes(item as BodyFitRiskTag)
      )
    : undefined;

  const normalized: BodyProfile = {
    upper_body_presence:
      raw.upper_body_presence === "low" ||
      raw.upper_body_presence === "medium" ||
      raw.upper_body_presence === "high"
        ? raw.upper_body_presence
        : undefined,
    belly_visibility:
      raw.belly_visibility === "low" ||
      raw.belly_visibility === "medium" ||
      raw.belly_visibility === "high"
        ? raw.belly_visibility
        : undefined,
    leg_length_impression:
      raw.leg_length_impression === "shorter" ||
      raw.leg_length_impression === "balanced" ||
      raw.leg_length_impression === "longer"
        ? raw.leg_length_impression
        : undefined,
    fit_risk_tags: fitRiskTags?.length ? fitRiskTags : undefined
  };

  return Object.values(normalized).some(Boolean) ? normalized : undefined;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `~/.nvm/versions/node/v22.19.0/bin/npx vitest run tests/unit/body-profile.test.ts`

Expected: PASS with `1 passed`

- [ ] **Step 6: Commit**

```bash
git add lib/agents/contracts.ts lib/agents/body-profile.ts tests/unit/body-profile.test.ts
git commit -m "Add body-aware recommendation contracts"
```

---

### Task 2: Build failure-avoidance recommendation engine

**Files:**
- Create: `lib/product/body-aware-recommendation.ts`
- Modify: `lib/product/recommendation-mix.ts`
- Test: `tests/unit/body-aware-recommendation.test.ts`
- Test: `tests/unit/recommendation-mix.test.ts`

- [ ] **Step 1: Write the failing rule-engine test**

```ts
import { describe, expect, it } from "vitest";
import { buildBodyAwareRecommendation } from "@/lib/product/body-aware-recommendation";

describe("body aware recommendation", () => {
  it("removes risky short bright top and skinny bottoms for large-frame users", () => {
    const result = buildBodyAwareRecommendation({
      survey: {
        current_style: "반팔 티셔츠 + 반바지",
        motivation: "주말 외출",
        budget: "기존 옷 활용"
      },
      bodyProfile: {
        overall_frame: "large",
        belly_visibility: "high",
        leg_length_impression: "shorter",
        fit_risk_tags: ["cropped_top_risk", "skinny_bottom_risk", "strong_contrast_split_risk"]
      },
      closetItems: [
        { id: "top-safe", category: "tops", name: "검정 레귤러 티셔츠", fit: "레귤러", wear_state: "잘 맞음" },
        { id: "top-risk", category: "tops", name: "밝은 짧은 티셔츠", fit: "크롭", wear_state: "타이트" },
        { id: "bottom-safe", category: "bottoms", name: "차콜 팬츠", fit: "테이퍼드", wear_state: "잘 맞음" },
        { id: "bottom-risk", category: "bottoms", name: "슬림 팬츠", fit: "슬림", wear_state: "타이트" },
        { id: "shoes-safe", category: "shoes", name: "검정 운동화", wear_state: "잘 맞음" }
      ]
    });

    expect(result.safeClosetItemIds).toEqual(["top-safe", "bottom-safe", "shoes-safe"]);
    expect(result.rejectedClosetItemIds).toEqual(expect.arrayContaining(["top-risk", "bottom-risk"]));
    expect(result.recommended_outfit.items).toEqual(["검정 레귤러 티셔츠", "차콜 팬츠", "검정 운동화"]);
    expect(result.recommended_outfit.avoid_notes).toEqual([
      "짧은 상의는 제외",
      "붙는 하의는 제외",
      "강한 상하 대비는 제외"
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `~/.nvm/versions/node/v22.19.0/bin/npx vitest run tests/unit/body-aware-recommendation.test.ts`

Expected: FAIL with `Cannot find module '@/lib/product/body-aware-recommendation'`

- [ ] **Step 3: Create the body-aware composer**

```ts
import type { AgentClosetItem, BodyProfile, OutfitRecommendation, SurveyInput } from "@/lib/agents/contracts";

type BuildBodyAwareRecommendationInput = {
  survey: SurveyInput;
  bodyProfile?: BodyProfile;
  closetItems: AgentClosetItem[];
};

export function buildBodyAwareRecommendation(input: BuildBodyAwareRecommendationInput): {
  safeClosetItemIds: string[];
  rejectedClosetItemIds: string[];
  recommended_outfit: OutfitRecommendation;
} {
  const rejectedClosetItemIds = input.closetItems
    .filter((item) => {
      if (item.category === "tops" && input.bodyProfile?.fit_risk_tags?.includes("cropped_top_risk")) {
        return item.fit?.includes("크롭") || item.name.includes("짧");
      }
      if (item.category === "bottoms" && input.bodyProfile?.fit_risk_tags?.includes("skinny_bottom_risk")) {
        return item.fit?.includes("슬림") || item.fit?.includes("스키니");
      }
      return false;
    })
    .map((item) => item.id);

  const safeItems = input.closetItems.filter((item) => !rejectedClosetItemIds.includes(item.id));
  const top = safeItems.find((item) => item.category === "tops");
  const bottom = safeItems.find((item) => item.category === "bottoms");
  const shoes = safeItems.find((item) => item.category === "shoes");

  return {
    safeClosetItemIds: [top?.id, bottom?.id, shoes?.id].filter(Boolean) as string[],
    rejectedClosetItemIds,
    recommended_outfit: {
      title: "안전한 기본 조합",
      items: [top?.name ?? "상의", bottom?.name ?? "하의", shoes?.name ?? "신발"],
      reason: "현재 체형에서 시선이 과하게 몰리지 않고 가장 무난하게 정리되는 조합입니다.",
      safety_basis: [
        "상체를 과하게 키우지 않음",
        "하체 라인이 안정적으로 보임",
        "지금 옷장에서 바로 재현 가능"
      ],
      avoid_notes: [
        "짧은 상의는 제외",
        "붙는 하의는 제외",
        "강한 상하 대비는 제외"
      ],
      try_on_prompt: "전체 조합을 자연스럽게 적용하고 비율이 더 안정적으로 보이게 정리"
    }
  };
}
```

- [ ] **Step 4: Wire the new composer into `lib/product/recommendation-mix.ts`**

```ts
import { buildBodyAwareRecommendation } from "@/lib/product/body-aware-recommendation";

export type BuildHybridRecommendationInput = {
  survey: SurveyInput;
  bodyProfile?: BodyProfile;
  closetItems: AgentClosetItem[];
  closetStrategy?: ClosetStrategy;
  verifiedSourceItemIds: SourceItemIdMap;
};

const safeRecommendation = buildBodyAwareRecommendation({
  survey: input.survey,
  bodyProfile: input.bodyProfile,
  closetItems: input.closetItems
});
```

Add a new expectation in `tests/unit/recommendation-mix.test.ts`:

```ts
expect(result.recommended_outfit?.avoid_notes).toBeDefined();
expect(result.recommended_outfit?.safety_basis).toBeDefined();
```

- [ ] **Step 5: Run unit tests**

Run: `~/.nvm/versions/node/v22.19.0/bin/npx vitest run tests/unit/body-aware-recommendation.test.ts tests/unit/recommendation-mix.test.ts`

Expected: PASS with both suites green

- [ ] **Step 6: Commit**

```bash
git add lib/product/body-aware-recommendation.ts lib/product/recommendation-mix.ts tests/unit/body-aware-recommendation.test.ts tests/unit/recommendation-mix.test.ts
git commit -m "Add failure-avoidance style recommendation engine"
```

---

### Task 3: Compose body-aware feedback in `/api/feedback`

**Files:**
- Modify: `app/api/feedback/route.ts`
- Modify: `lib/agents/mock-feedback.ts`
- Modify: `lib/agents/gemini.ts`
- Test: `tests/integration/feedback-route.test.ts`

- [ ] **Step 1: Write the failing integration test**

Add this test block to `tests/integration/feedback-route.test.ts`:

```ts
it("returns body-aware safety basis and avoid notes in the final response", async () => {
  const { POST } = await loadRouteWithCookies(
    await buildAuthCookies({
      ...authUser,
      uid: "feedback-body-aware-user"
    })
  );

  const response = await POST(
    buildRequest({
      ...validFeedbackPayload,
      body_profile: {
        overall_frame: "large",
        belly_visibility: "high",
        leg_length_impression: "shorter",
        fit_risk_tags: ["cropped_top_risk", "skinny_bottom_risk", "strong_contrast_split_risk"]
      },
      closet_items: [
        { id: "top-1", category: "tops", name: "검정 레귤러 티셔츠", fit: "레귤러", wear_state: "잘 맞음" },
        { id: "bottom-1", category: "bottoms", name: "차콜 팬츠", fit: "테이퍼드", wear_state: "잘 맞음" },
        { id: "shoes-1", category: "shoes", name: "검정 운동화", wear_state: "잘 맞음" }
      ]
    })
  );

  const body = await response.json();

  expect(response.status).toBe(200);
  expect(body.recommended_outfit.safety_basis).toEqual([
    "상체를 과하게 키우지 않음",
    "하체 라인이 안정적으로 보임",
    "지금 옷장에서 바로 재현 가능"
  ]);
  expect(body.recommended_outfit.avoid_notes).toEqual([
    "짧은 상의는 제외",
    "붙는 하의는 제외",
    "강한 상하 대비는 제외"
  ]);
});
```

- [ ] **Step 2: Run the integration test to verify it fails**

Run: `~/.nvm/versions/node/v22.19.0/bin/npx vitest run tests/integration/feedback-route.test.ts`

Expected: FAIL because `recommended_outfit.safety_basis` and `avoid_notes` are missing

- [ ] **Step 3: Update route composition and provider fallbacks**

In `app/api/feedback/route.ts`, pass `bodyProfile` into the recommendation composer and overwrite the final outfit fields:

```ts
const hybrid = buildHybridRecommendation({
  survey: payload.survey,
  bodyProfile: payload.body_profile,
  closetItems: payload.closet_items ?? [],
  closetStrategy: payload.closet_strategy,
  verifiedSourceItemIds: verifiedSourceItemIds ?? {}
});

const verifiedFeedback = {
  ...feedback,
  recommended_outfit: {
    ...hybrid.recommended_outfit,
    source_item_ids: verifiedSourceItemIds
  },
  recommendation_mix: hybrid.recommendation_mix,
  system_recommendations: hybrid.system_recommendations,
  primary_outfit: hybrid.primary_outfit,
  selectable_recommendations: hybrid.selectable_recommendations
};
```

In `lib/agents/mock-feedback.ts`, make the base mock response include:

```ts
safety_basis: [
  "상체를 과하게 키우지 않음",
  "하체 라인이 안정적으로 보임",
  "지금 옷장에서 바로 재현 가능"
],
avoid_notes: [
  "짧은 상의는 제외",
  "붙는 하의는 제외",
  "강한 상하 대비는 제외"
]
```

In `lib/agents/gemini.ts`, sanitize missing provider fields to the same three-string structure before the route composes the final response.

- [ ] **Step 4: Re-run integration tests**

Run: `~/.nvm/versions/node/v22.19.0/bin/npx vitest run tests/integration/feedback-route.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/feedback/route.ts lib/agents/mock-feedback.ts lib/agents/gemini.ts tests/integration/feedback-route.test.ts
git commit -m "Compose body-aware feedback response"
```

---

### Task 4: Update result UX for safe recommendation language

**Files:**
- Modify: `app/onboarding/analyzing/page.tsx`
- Modify: `app/onboarding/result/page.tsx`
- Modify: `app/globals.css`
- Test: `tests/e2e/onboarding.spec.ts`

- [ ] **Step 1: Write the failing E2E assertion**

Add this scenario to `tests/e2e/onboarding.spec.ts` near the existing onboarding result assertions:

```ts
test("result shows safe recommendation summary and short avoid chips", async ({ page }) => {
  await page.goto("/programs/style/onboarding/result");

  await expect(page.getByText("오늘의 안전한 조합")).toBeVisible();
  await expect(page.getByText("피해야 할 것")).toBeVisible();
  await expect(page.getByText("짧은 상의는 제외")).toBeVisible();
  await expect(page.getByText("붙는 하의는 제외")).toBeVisible();
  await expect(page.getByText("강한 상하 대비는 제외")).toBeVisible();
});
```

- [ ] **Step 2: Run the E2E test to verify it fails**

Run: `~/.nvm/versions/node/v22.19.0/bin/npm run test:e2e -- --grep "safe recommendation summary"`

Expected: FAIL because the labels are not rendered yet

- [ ] **Step 3: Send `body_profile` from analyzing page**

In `app/onboarding/analyzing/page.tsx`, include `body_profile` in the payload shape that goes to `/api/feedback`:

```ts
const payload = {
  image: preparedImage,
  survey: state.survey,
  body_profile: state.body_profile,
  closet_profile: state.closet_profile,
  closet_items: state.closet_items,
  closet_strategy: state.closet_strategy,
  feedback_history: state.feedback_history ?? [],
  preference_profile: state.preference_profile
};
```

- [ ] **Step 4: Render the new safe recommendation block in result page**

In `app/onboarding/result/page.tsx`, add a compressed section:

```tsx
<section className="result-safe-summary">
  <div className="result-section-heading">
    <span>SAFE PICK</span>
    <h2>오늘의 안전한 조합</h2>
  </div>
  <p className="result-safe-reason">{feedback.recommended_outfit.reason}</p>
  <ul className="result-safe-basis">
    {feedback.recommended_outfit.safety_basis?.map((item) => (
      <li key={item}>{item}</li>
    ))}
  </ul>
  <div className="result-avoid-chips">
    {feedback.recommended_outfit.avoid_notes?.map((item) => (
      <span key={item} className="result-avoid-chip">
        {item}
      </span>
    ))}
  </div>
</section>
```

And in `app/globals.css`:

```css
.result-safe-summary {
  display: grid;
  gap: 12px;
}

.result-avoid-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.result-avoid-chip {
  border-radius: 999px;
  padding: 8px 12px;
  background: var(--surface-muted);
  color: var(--ink-strong);
  font-size: 13px;
  font-weight: 700;
}
```

- [ ] **Step 5: Run build and E2E**

Run: `~/.nvm/versions/node/v22.19.0/bin/npm run build`

Expected: `build 통과`

Run: `~/.nvm/versions/node/v22.19.0/bin/npm run test:e2e -- --grep "safe recommendation summary"`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/onboarding/analyzing/page.tsx app/onboarding/result/page.tsx app/globals.css tests/e2e/onboarding.spec.ts
git commit -m "Show safe recommendation UX in result screen"
```

---

### Task 5: Update harness rules and final verification

**Files:**
- Modify: `AGENTS.md`
- Test: `tests/unit/body-profile.test.ts`
- Test: `tests/unit/body-aware-recommendation.test.ts`
- Test: `tests/unit/recommendation-mix.test.ts`
- Test: `tests/integration/feedback-route.test.ts`
- Test: `tests/e2e/onboarding.spec.ts`

- [ ] **Step 1: Add harness verification rules**

Append these bullets to the recommendation verification section in `AGENTS.md`:

```md
- body-aware recommendation을 수정하면 `/api/feedback` payload에 `body_profile`이 포함되는지 unit 또는 integration으로 검증해야 한다.
- body-aware recommendation을 완료라고 보고하려면 위험 후보 제거 규칙 테스트와 결과 화면 UX 검증을 함께 통과해야 한다.
- `recommended_outfit.safety_basis` 또는 `avoid_notes` 없이 체형 맞춤 추천이라고 보고하면 실패다.
- 결과 화면에서 시스템 추천이 `내 옷장 기준`보다 더 앞서거나 더 크게 보이면 실패다.
- 체형 관련 결과 문구에 직접 평가/비하 표현이 들어가면 실패다.
```

- [ ] **Step 2: Run focused test suite**

Run:

```bash
~/.nvm/versions/node/v22.19.0/bin/npx vitest run tests/unit/body-profile.test.ts tests/unit/body-aware-recommendation.test.ts tests/unit/recommendation-mix.test.ts tests/integration/feedback-route.test.ts
```

Expected: PASS

- [ ] **Step 3: Run browser verification**

Run:

```bash
~/.nvm/versions/node/v22.19.0/bin/npm run test:e2e -- --grep "safe recommendation summary|hybrid recommendation"
```

Expected: PASS

- [ ] **Step 4: Run final build**

Run:

```bash
~/.nvm/versions/node/v22.19.0/bin/npm run build
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md
git commit -m "Add body-aware recommendation harness rules"
```

---

## Self-Review

### Spec coverage

- `body_profile` 입력 계약 추가: Task 1
- failure-avoidance recommendation: Task 2
- route composition and provider-safe output: Task 3
- short UX structure for safe recommendation: Task 4
- harness and verification rules: Task 5

No spec gaps remain for the scoped feature.

### Placeholder scan

- No `TBD`, `TODO`, or "implement later" placeholders remain.
- Each code-changing step includes concrete code or exact assertions.
- Each verification step has an exact command and expected outcome.

### Type consistency

- `body_profile` is added to `AgentRequest` first in Task 1, then used by route/result tasks later.
- `safety_basis` and `avoid_notes` are added to `OutfitRecommendation` before route and UI tasks depend on them.
- `buildBodyAwareRecommendation()` is introduced in Task 2 before `buildHybridRecommendation()` consumes it.

