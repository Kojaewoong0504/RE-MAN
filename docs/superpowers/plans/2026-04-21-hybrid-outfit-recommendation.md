# Hybrid Outfit Recommendation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자 결과 화면에 `내 옷장 기준` 추천과 `시스템 추천` 보강 스타일을 함께 보여주고, 옷장 신뢰도에 따라 메인/보조 우선순위를 바꾼다.

**Architecture:** 기존 모델 응답인 `recommended_outfit`는 유지하고, 서버 후처리 레이어에서 `recommendation_mix`와 `system_recommendations`를 합성한다. 공통 추천은 MVP 동안 정적 `system_style_library`에서 `reference` 아이템만 선택하며, 결과 UI는 `primary_source`에 따라 블록 순서를 바꾼다.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, Playwright, local onboarding state, existing `/api/feedback` route.

---

### Task 1: Expand Contracts For Hybrid Recommendation

**Files:**
- Modify: `lib/agents/contracts.ts`
- Test: `tests/unit/agents-contracts.test.ts`

- [ ] **Step 1: Write the failing contract test**

```ts
import type { OnboardingAgentResponse } from "@/lib/agents/contracts";

const response: OnboardingAgentResponse = {
  diagnosis: "진단",
  improvements: ["a", "b", "c"],
  recommended_outfit: {
    title: "기본 조합",
    items: ["상의", "하의", "신발"],
    reason: "지금 가진 옷으로 가능",
    try_on_prompt: "prompt"
  },
  recommendation_mix: {
    primary_source: "closet",
    closet_confidence: "high",
    system_support_needed: true,
    missing_categories: ["outerwear"],
    summary: "겉옷 보강 필요"
  },
  system_recommendations: [
    {
      id: "sys-top-1",
      mode: "reference",
      category: "tops",
      title: "네이비 옥스포드 셔츠",
      color: "네이비",
      fit: "레귤러",
      season: ["봄", "가을"],
      style_tags: ["clean"],
      reason: "정돈된 인상",
      image_url: "/system-catalog/navy-oxford.jpg",
      product: null
    }
  ],
  today_action: "오늘 할 것",
  day1_mission: "오늘 미션"
};

expect(response.system_recommendations[0].mode).toBe("reference");
expect(response.recommendation_mix.primary_source).toBe("closet");
```

- [ ] **Step 2: Run the unit test to verify it fails**

Run: `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test:unit -- tests/unit/agents-contracts.test.ts`

Expected: FAIL because `OnboardingAgentResponse` does not yet include `recommendation_mix` or `system_recommendations`.

- [ ] **Step 3: Implement minimal type additions**

Add these types in `lib/agents/contracts.ts`:

```ts
export type RecommendationPrimarySource = "closet" | "system";
export type ClosetConfidence = "high" | "medium" | "low";

export type RecommendationMix = {
  primary_source: RecommendationPrimarySource;
  closet_confidence: ClosetConfidence;
  system_support_needed: boolean;
  missing_categories: AgentClosetItemCategory[];
  summary: string;
};

export type SystemRecommendation = {
  id: string;
  mode: "reference";
  category: AgentClosetItemCategory;
  title: string;
  color?: string;
  fit?: string;
  season?: string[];
  style_tags?: string[];
  reason: string;
  image_url?: string;
  product: null;
};
```

Then extend `OnboardingAgentResponse`:

```ts
export type OnboardingAgentResponse = {
  diagnosis: string;
  improvements: [string, string, string];
  recommended_outfit: OutfitRecommendation;
  recommendation_mix: RecommendationMix;
  system_recommendations: SystemRecommendation[];
  today_action: string;
  day1_mission: string;
};
```

- [ ] **Step 4: Run the unit test again**

Run: `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test:unit -- tests/unit/agents-contracts.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/agents/contracts.ts tests/unit/agents-contracts.test.ts
git commit -m "feat: add hybrid recommendation contracts"
```

### Task 2: Add Server-Side Mix Heuristic And System Style Library

**Files:**
- Create: `lib/product/system-style-library.ts`
- Create: `lib/product/recommendation-mix.ts`
- Test: `tests/unit/recommendation-mix.test.ts`

- [ ] **Step 1: Write the failing heuristic test**

```ts
import { buildHybridRecommendation } from "@/lib/product/recommendation-mix";

const result = buildHybridRecommendation({
  survey: {
    current_style: "청바지 + 무지 티셔츠",
    motivation: "소개팅 / 이성 만남",
    budget: "15~30만원",
    style_goal: "전체적인 스타일 리셋"
  },
  closetItems: [],
  verifiedSourceItemIds: {},
  closetStrategy: {
    core_item_ids: [],
    caution_item_ids: [],
    optional_item_ids: [],
    items: []
  }
});

expect(result.recommendation_mix.primary_source).toBe("system");
expect(result.recommendation_mix.closet_confidence).toBe("low");
expect(result.system_recommendations.length).toBeGreaterThan(0);
expect(result.system_recommendations.every((item) => item.mode === "reference")).toBe(true);
expect(result.system_recommendations.every((item) => item.product === null)).toBe(true);
```

- [ ] **Step 2: Run the heuristic unit test to verify it fails**

Run: `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test:unit -- tests/unit/recommendation-mix.test.ts`

Expected: FAIL because the helper and library do not exist.

- [ ] **Step 3: Add a minimal static style library**

Create `lib/product/system-style-library.ts` with a focused MVP seed:

```ts
import type { SystemRecommendation } from "@/lib/agents/contracts";

export const SYSTEM_STYLE_LIBRARY: SystemRecommendation[] = [
  {
    id: "sys-top-navy-oxford",
    mode: "reference",
    category: "tops",
    title: "네이비 옥스포드 셔츠",
    color: "네이비",
    fit: "레귤러",
    season: ["봄", "가을"],
    style_tags: ["clean", "date", "office-casual"],
    reason: "얼굴 주변을 정돈하고 슬랙스와 연결하기 쉽습니다.",
    image_url: "/system-catalog/navy-oxford.jpg",
    product: null
  },
  {
    id: "sys-bottom-charcoal-slacks",
    mode: "reference",
    category: "bottoms",
    title: "차콜 슬랙스",
    color: "차콜",
    fit: "세미와이드",
    season: ["봄", "가을", "겨울"],
    style_tags: ["clean", "date", "office-casual"],
    reason: "상의를 정리해 보여주고 전체 비율을 안정적으로 잡아줍니다.",
    image_url: "/system-catalog/charcoal-slacks.jpg",
    product: null
  },
  {
    id: "sys-shoes-white-leather",
    mode: "reference",
    category: "shoes",
    title: "화이트 레더 스니커즈",
    color: "화이트",
    fit: "로우탑",
    season: ["사계절"],
    style_tags: ["clean", "starter"],
    reason: "초보자가 가장 쉽게 매치할 수 있는 정리용 신발입니다.",
    image_url: "/system-catalog/white-leather-sneakers.jpg",
    product: null
  }
];
```

- [ ] **Step 4: Implement the mix helper**

Create `lib/product/recommendation-mix.ts` with:

```ts
import type {
  AgentClosetItem,
  ClosetStrategy,
  RecommendationMix,
  SurveyInput,
  SystemRecommendation
} from "@/lib/agents/contracts";
import { SYSTEM_STYLE_LIBRARY } from "@/lib/product/system-style-library";

type BuildHybridRecommendationInput = {
  survey: SurveyInput;
  closetItems: AgentClosetItem[];
  closetStrategy?: ClosetStrategy;
  verifiedSourceItemIds: Partial<Record<"tops" | "bottoms" | "shoes" | "outerwear", string>>;
};

export function buildHybridRecommendation(
  input: BuildHybridRecommendationInput
): {
  recommendation_mix: RecommendationMix;
  system_recommendations: SystemRecommendation[];
} {
  const requiredCategories = new Set(input.closetItems.map((item) => item.category));
  const missing = (["tops", "bottoms", "shoes"] as const).filter(
    (category) => !requiredCategories.has(category)
  );
  const coreCount = input.closetStrategy?.core_item_ids.length ?? 0;
  const verifiedCount = Object.values(input.verifiedSourceItemIds).filter(Boolean).length;
  const closet_confidence =
    missing.length > 0 || coreCount === 0
      ? "low"
      : verifiedCount >= 2 && coreCount >= 2
        ? "high"
        : "medium";
  const primary_source = closet_confidence === "low" ? "system" : "closet";

  return {
    recommendation_mix: {
      primary_source,
      closet_confidence,
      system_support_needed: closet_confidence !== "high" || missing.length > 0,
      missing_categories: missing,
      summary:
        primary_source === "system"
          ? "지금 옷장만으로는 방향이 약해 시스템 추천을 먼저 보여줍니다."
          : missing.length > 0
            ? `${missing.join(", ")} 방향은 시스템 추천으로 보강합니다.`
            : "주 조합은 옷장 기준으로 구성하고 시스템 추천은 보조로 제공합니다."
    },
    system_recommendations: SYSTEM_STYLE_LIBRARY.filter(
      (item) => missing.length === 0 || missing.includes(item.category)
    )
  };
}
```

- [ ] **Step 5: Run the heuristic unit test**

Run: `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test:unit -- tests/unit/recommendation-mix.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/product/system-style-library.ts lib/product/recommendation-mix.ts tests/unit/recommendation-mix.test.ts
git commit -m "feat: add system style recommendation mix"
```

### Task 3: Attach Hybrid Recommendation In `/api/feedback`

**Files:**
- Modify: `app/api/feedback/route.ts`
- Test: `tests/integration/feedback-route.test.ts`

- [ ] **Step 1: Write the failing integration test**

```ts
const response = await POST(
  new Request("http://localhost/api/feedback", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: authCookie
    },
    body: JSON.stringify(validPayloadWithoutReliableCloset)
  })
);

const data = await response.json();

expect(data.recommendation_mix.primary_source).toBe("system");
expect(data.recommendation_mix.closet_confidence).toBe("low");
expect(Array.isArray(data.system_recommendations)).toBe(true);
expect(data.system_recommendations[0].mode).toBe("reference");
expect(data.system_recommendations[0].product).toBeNull();
```

- [ ] **Step 2: Run the integration test to verify it fails**

Run: `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test:integration -- tests/integration/feedback-route.test.ts`

Expected: FAIL because `/api/feedback` does not yet append the new fields.

- [ ] **Step 3: Implement route composition**

In `app/api/feedback/route.ts`, after `sanitizeSourceItemIdsForCloset`, add:

```ts
import { buildHybridRecommendation } from "@/lib/product/recommendation-mix";

const verifiedSourceItemIds = sanitizeSourceItemIdsForCloset(
  feedback.recommended_outfit.source_item_ids,
  payload.closet_items
);

const hybrid = buildHybridRecommendation({
  survey: payload.survey,
  closetItems: payload.closet_items ?? [],
  closetStrategy: payload.closet_strategy,
  verifiedSourceItemIds
});

const verifiedFeedback = {
  ...feedback,
  recommended_outfit: {
    ...feedback.recommended_outfit,
    source_item_ids: verifiedSourceItemIds
  },
  recommendation_mix: hybrid.recommendation_mix,
  system_recommendations: hybrid.system_recommendations
};
```

- [ ] **Step 4: Run the integration test**

Run: `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test:integration -- tests/integration/feedback-route.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/feedback/route.ts tests/integration/feedback-route.test.ts
git commit -m "feat: compose hybrid recommendation in feedback route"
```

### Task 4: Render Closet And System Recommendation Blocks

**Files:**
- Modify: `app/onboarding/result/page.tsx`
- Modify: `app/globals.css`
- Test: `tests/e2e/onboarding.spec.ts`

- [ ] **Step 1: Write the failing E2E assertions**

Add two explicit scenarios to `tests/e2e/onboarding.spec.ts`.

Scenario A, high closet confidence:

```ts
await expect(page.getByText("내 옷장 기준").first()).toBeVisible();
await expect(page.getByText("시스템 추천").first()).toBeVisible();
const closetBlock = page.getByRole("region", { name: "내 옷장 조합" });
const systemBlock = page.getByRole("region", { name: "시스템 추천 조합" });
expect((await closetBlock.boundingBox())!.y).toBeLessThan((await systemBlock.boundingBox())!.y);
```

Scenario B, low closet confidence:

```ts
const closetBlock = page.getByRole("region", { name: "내 옷장 조합" });
const systemBlock = page.getByRole("region", { name: "시스템 추천 조합" });
expect((await systemBlock.boundingBox())!.y).toBeLessThan((await closetBlock.boundingBox())!.y);
await expect(systemBlock.getByText("reference")).toBeVisible();
await expect(systemBlock.getByRole("link", { name: /구매|shop|buy/i })).toHaveCount(0);
```

- [ ] **Step 2: Run the targeted E2E test to verify it fails**

Run: `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test:e2e -- --grep "hybrid recommendation"`

Expected: FAIL because the result page does not yet render split blocks.

- [ ] **Step 3: Implement result page rendering**

In `app/onboarding/result/page.tsx`:

```ts
const primarySource = feedback.recommendation_mix.primary_source;

const closetSection = (
  <section aria-label="내 옷장 조합" className="result-recommendation-block">
    <p className="poster-kicker">내 옷장 기준</p>
    <h3>{feedback.recommended_outfit.title}</h3>
    <div className="result-item-strip">
      {feedback.recommended_outfit.items.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </div>
    <p>{feedback.recommendation_mix.summary}</p>
  </section>
);

const systemSection = feedback.system_recommendations.length ? (
  <section aria-label="시스템 추천 조합" className="result-recommendation-block result-recommendation-block-system">
    <p className="poster-kicker">시스템 추천</p>
    <ul className="system-recommendation-list">
      {feedback.system_recommendations.map((item) => (
        <li key={item.id} className="system-recommendation-card">
          <span className="system-recommendation-badge">reference</span>
          <strong>{item.title}</strong>
          <p>{item.reason}</p>
        </li>
      ))}
    </ul>
  </section>
) : null;
```

Render order:

```ts
{primarySource === "system" ? (
  <>
    {systemSection}
    {closetSection}
  </>
) : (
  <>
    {closetSection}
    {systemSection}
  </>
)}
```

In `app/globals.css`, add focused classes:

```css
.result-recommendation-block {
  @apply space-y-4 rounded-[28px] bg-[var(--color-surface-raised)] p-5;
}

.result-recommendation-block-system {
  background:
    radial-gradient(circle at top right, rgba(27, 38, 59, 0.08), transparent 35%),
    var(--color-surface-raised);
}

.system-recommendation-card {
  @apply space-y-2 rounded-2xl bg-[var(--color-surface)] p-4;
}

.system-recommendation-badge {
  @apply inline-flex rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em];
  background: rgba(5, 17, 37, 0.08);
  color: var(--color-accent);
}
```

- [ ] **Step 4: Run the targeted E2E test**

Run: `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test:e2e -- --grep "hybrid recommendation"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/onboarding/result/page.tsx app/globals.css tests/e2e/onboarding.spec.ts
git commit -m "feat: show hybrid recommendation blocks"
```

### Task 5: Add Harness Rules And Final Verification

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/product/closet-recommendation-basis.md`
- Modify: `docs/engineering/verification-matrix.md`

- [ ] **Step 1: Add failing doc assertions via content-rules test fixture or doc expectations**

Add checks that capture:

```md
- `recommendation_mix.primary_source`와 결과 화면 메인 블록 순서는 항상 일치해야 한다.
- `system_recommendations[].mode = reference`일 때 구매 CTA나 가격 문구를 노출하면 실패다.
- 시스템 추천은 항상 `시스템 추천` 출처 라벨을 가져야 한다.
```

- [ ] **Step 2: Run harness/doc checks to verify the new rule is enforced**

Run: `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run check:content`

Expected: FAIL before docs are updated, or existing harness/doc validation surfaces the missing rule.

- [ ] **Step 3: Update harness docs**

Append the exact rules above to:

```md
AGENTS.md
docs/product/closet-recommendation-basis.md
docs/engineering/verification-matrix.md
```

Also document the two supported result sources:

```md
- `내 옷장 기준`
- `시스템 추천`
```

- [ ] **Step 4: Run final verification**

Run these commands sequentially:

```bash
PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test:unit -- tests/unit/agents-contracts.test.ts tests/unit/recommendation-mix.test.ts
PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test:integration -- tests/integration/feedback-route.test.ts
PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test:e2e -- --grep "hybrid recommendation|onboarding flow captures input and renders feedback"
PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run visual:app
PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run build
```

Expected:

- unit PASS
- integration PASS
- targeted E2E PASS
- visual smoke writes fresh screenshots
- build PASS

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md docs/product/closet-recommendation-basis.md docs/engineering/verification-matrix.md
git commit -m "docs: add hybrid recommendation harness rules"
```
