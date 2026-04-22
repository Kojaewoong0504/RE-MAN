# Selective Try-On And Expanded Style Categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 결과 화면의 시스템 추천을 선택 가능한 카드 후보군으로 바꾸고, 사용자가 원하는 아이템만 골라 자동 정렬 또는 제한된 수동 정렬로 실착을 생성할 수 있게 한다. 동시에 `outerwear`, `hats`, `bags`까지 1차 카테고리 확장을 지원하고, 추천이 상의 카드만 몰리지 않도록 균형 규칙을 추가한다.

**Architecture:** 현재 `recommended_outfit + recommendation_mix + system_recommendations` 구조 위에 `primary_outfit + selectable_recommendations + try_on_selection` 계층을 추가한다. 서버는 `/api/feedback`에서 role-aware 시스템 후보를 합성하고, 결과 화면은 선택 상태를 따로 관리한다. `/api/try-on`은 선택된 아이템 집합을 입력으로 받아 direct 최대 3개 시도 후 layered fallback으로 내려가며, 과금은 `최대 3개당 1크레딧`으로 유지한다.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, Playwright, Firestore-backed onboarding state, existing Gemini feedback route, existing Vertex try-on adapter.

---

### Task 1: Expand Domain Contracts For Selective Recommendation And Try-On

**Files:**
- Modify: `lib/agents/contracts.ts`
- Test: `tests/unit/agents-contracts.test.ts`

- [ ] **Step 1: Write the failing contract test**

Add coverage for:

- `AgentClosetItemCategory` including `hats` and `bags`
- `SystemRecommendation.role`
- `OnboardingAgentResponse.primary_outfit`
- `OnboardingAgentResponse.selectable_recommendations`
- `TryOnSelectionItem` and request payload with `selected_items`, `ordered_item_ids`, `manual_order_enabled`

Example assertions:

```ts
expectTypeOf<AgentClosetItemCategory>().toEqualTypeOf<
  "tops" | "bottoms" | "shoes" | "outerwear" | "hats" | "bags"
>();

const response: OnboardingAgentResponse = {
  diagnosis: "진단",
  improvements: ["a", "b", "c"],
  recommended_outfit: {
    title: "기존 조합",
    items: ["상의", "하의", "신발"],
    reason: "기존 경로 유지",
    try_on_prompt: "prompt"
  },
  recommendation_mix: {
    primary_source: "system",
    closet_confidence: "low",
    system_support_needed: true,
    missing_categories: ["bottoms"],
    summary: "시스템 보강"
  },
  system_recommendations: [],
  primary_outfit: {
    title: "기본 추천",
    item_ids: ["sys-top-1", "sys-bottom-1", "sys-shoes-1"],
    reason: "조합 가능"
  },
  selectable_recommendations: [
    {
      id: "sys-top-1",
      category: "tops",
      role: "base_top",
      title: "화이트 티셔츠",
      reason: "기본 시작점",
      image_url: "/system-catalog/tops/white.jpg",
      compatibility_tags: ["clean"],
      layer_order_default: 10
    }
  ],
  today_action: "액션",
  day1_mission: "미션"
};

expect(response.selectable_recommendations[0].role).toBe("base_top");
```

- [ ] **Step 2: Run the unit test to verify it fails**

Run:
`PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test:unit -- tests/unit/agents-contracts.test.ts`

Expected: FAIL because the new category/role/response fields do not yet exist.

- [ ] **Step 3: Implement minimal contract additions**

Add:

- `AgentClosetItemCategory`: `hats`, `bags`
- `RecommendationRole`: `base_top | mid_top | outerwear | bottom | shoes | addon`
- `PrimaryOutfit`
- `SelectableRecommendation`
- `TryOnSelectionItem`
- optional response extensions on `OnboardingAgentResponse`
- typed request contract for selective try-on payload

Guidelines:

- Keep `recommended_outfit` for backward compatibility during migration.
- Do not delete existing `system_recommendations` yet; treat it as compatibility output until result page migration is complete.
- New structures should be additive first.

- [ ] **Step 4: Run the contract unit test again**

Run:
`PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test:unit -- tests/unit/agents-contracts.test.ts`

Expected: PASS.

---

### Task 2: Upgrade System Recommendation Library And Mix Builder

**Files:**
- Modify: `lib/product/system-style-library.ts`
- Modify: `lib/product/recommendation-mix.ts`
- Test: `tests/unit/recommendation-mix.test.ts`

- [ ] **Step 1: Write the failing recommendation mix tests**

Add tests for:

- role-aware recommendation cards
- balanced recommendation rule
- category expansion to `outerwear`, `hats`, `bags`
- `primary_outfit` composition including at least a base combination when possible

Example expectations:

```ts
const result = buildHybridRecommendation({
  survey,
  closetItems: [],
  closetStrategy: undefined,
  verifiedSourceItemIds: {}
});

expect(result.primary_outfit.item_ids.length).toBeGreaterThanOrEqual(2);
expect(result.selectable_recommendations.some((item) => item.role === "base_top")).toBe(true);
expect(result.selectable_recommendations.some((item) => item.role === "bottom")).toBe(true);
expect(result.selectable_recommendations.some((item) => item.role === "shoes")).toBe(true);
expect(result.selectable_recommendations.every((item) => item.image_url)).toBe(true);
```

- [ ] **Step 2: Run the mix unit test to verify it fails**

Run:
`PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test:unit -- tests/unit/recommendation-mix.test.ts`

Expected: FAIL because the current builder only returns a simple `system_recommendations` list.

- [ ] **Step 3: Extend the system style library**

Update `lib/product/system-style-library.ts` so library entries include:

- `category`
- `role`
- `compatibility_tags`
- `layer_order_default`
- image assets for `outerwear`, `hats`, `bags`

Rules:

- Keep entries as `reference` only.
- Do not add purchase links, price, stock, or product CTAs.
- Ensure first-phase categories exist with at least minimal coverage:
  - `tops`
  - `bottoms`
  - `shoes`
  - `outerwear`
  - `hats`
  - `bags`

- [ ] **Step 4: Rebuild recommendation mix logic**

Update `lib/product/recommendation-mix.ts` to:

- score candidates by survey, closet state, preference history, and missing categories
- compose `primary_outfit`
- return `selectable_recommendations`
- enforce balanced recommendation rule
- preserve existing `recommendation_mix`
- continue returning `system_recommendations` as compatibility output during transition

Implementation guidance:

- Prefer additive compatibility over a hard break.
- If a role is weak or missing, return fewer cards plus an explicit summary rather than flooding tops.
- Make `outerwear`, `hats`, `bags` additive support roles, not replacements for the core base combination.

- [ ] **Step 5: Run the unit tests again**

Run:
`PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test:unit -- tests/unit/recommendation-mix.test.ts`

Expected: PASS.

---

### Task 3: Update `/api/feedback` To Emit Selective Recommendation Payload

**Files:**
- Modify: `app/api/feedback/route.ts`
- Test: `tests/integration/feedback-route.test.ts`

- [ ] **Step 1: Write the failing route integration test**

Cover:

- response includes `primary_outfit`
- response includes `selectable_recommendations`
- categories remain balanced
- legacy `recommended_outfit` is still present
- `source_item_ids` sanitization still works

Example assertions:

```ts
expect(body.primary_outfit).toBeDefined();
expect(body.selectable_recommendations.length).toBeGreaterThan(0);
expect(body.recommended_outfit).toBeDefined();
expect(body.selectable_recommendations.some((item) => item.category === "bottoms")).toBe(true);
```

- [ ] **Step 2: Run the integration test to verify it fails**

Run:
`PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test:integration -- tests/integration/feedback-route.test.ts`

Expected: FAIL because the route does not yet emit the new fields.

- [ ] **Step 3: Implement server response composition**

In `app/api/feedback/route.ts`:

- merge `primary_outfit` and `selectable_recommendations` from the mix builder
- keep existing `recommended_outfit` for old consumers
- preserve `recommendation_mix` and `system_recommendations`
- ensure category balancing is enforced before response leaves the route

- [ ] **Step 4: Run the integration test again**

Run:
`PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test:integration -- tests/integration/feedback-route.test.ts`

Expected: PASS.

---

### Task 4: Rebuild Result Page For Selectable Cards And Layer Editing

**Files:**
- Modify: `app/onboarding/result/page.tsx`
- Test: `tests/e2e/onboarding.spec.ts`
- Verify: `npm run visual:app`

- [ ] **Step 1: Write the failing E2E test**

Cover the new golden path:

1. analysis result renders `primary_outfit`
2. selectable recommendation cards appear
3. user can choose specific cards
4. auto ordering is shown
5. manual layer editor can be opened
6. invalid reorder is blocked
7. credit estimate changes with selected item count

Suggested grep name:
`selective try-on supports role-aware selection and manual order`

- [ ] **Step 2: Run the E2E test to verify it fails**

Run:
`PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test:e2e -- --grep "selective try-on supports role-aware selection and manual order"`

Expected: FAIL because the current result page still builds try-on from fixed category cards.

- [ ] **Step 3: Implement result page state model**

In `app/onboarding/result/page.tsx`:

- add client state for:
  - `selected_item_ids`
  - `manual_order_enabled`
  - `ordered_item_ids`
  - `validation_state`
  - `warnings`
- derive default selection from `primary_outfit`
- separate:
  - basic recommendation view
  - selectable card grid
  - selection summary / try-on panel

- [ ] **Step 4: Implement auto ordering and manual override UI**

Add:

- automatic role ordering
- `레이어 수정` drawer/modal
- reorder controls
- `자동 정렬로 복원`
- user-facing labels instead of raw internal role names

Rules:

- keep the UI compact enough for mobile
- block impossible combinations immediately
- do not overflow long action copy; shorten or wrap safely
- keep credit status inside the app layout, not as a floating page overlay

- [ ] **Step 5: Update try-on summary and preview source selection**

The current try-on section still assumes a fixed `system` vs `closet` source. Replace that with:

- selected-item summary
- ordered item chips/cards
- real credit estimate
- CTA tied to the current selected set

- [ ] **Step 6: Run visual verification**

Run:
`PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run visual:app`

Expected:

- no old-design remnants in the result view
- selection panel sits inside the app shell
- modal overlay covers the full viewport correctly

- [ ] **Step 7: Run the E2E test again**

Run:
`PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test:e2e -- --grep "selective try-on supports role-aware selection and manual order"`

Expected: PASS.

---

### Task 5: Upgrade `/api/try-on` And Vertex Adapter For Selected Item Sets

**Files:**
- Modify: `app/api/try-on/route.ts`
- Modify: `lib/agents/try-on.ts`
- Modify: `tests/unit/try-on.test.ts`
- Modify: `tests/integration/try-on-route.test.ts`
- Verify: `scripts/smoke-try-on-vertex.py`

- [ ] **Step 1: Write failing tests for selection-aware try-on**

Add coverage for:

- `selected_items` input
- role/order validation
- canonical ordering before provider payload
- `1~3 items = 1 credit`, `4~6 = 2 credits`
- direct-up-to-3 behavior
- fallback to sequential pass when multi-image direct fails

- [ ] **Step 2: Run unit and integration tests to verify failures**

Run:

- `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test:unit -- tests/unit/try-on.test.ts`
- `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test:integration -- tests/integration/try-on-route.test.ts`

Expected: FAIL because route/UI still depend on fixed product image inputs and current tests cover only the legacy shape.

- [ ] **Step 3: Normalize server-side ordering and validation**

In `app/api/try-on/route.ts` and helper modules:

- accept `selected_items`
- resolve images from those items
- validate category/role limits
- convert manual order into canonical provider order
- compute credit charge from selected item count, not pass count
- keep `Idempotency-Key` protection

- [ ] **Step 4: Finalize Vertex strategy**

In `lib/agents/try-on.ts`:

- keep `product_images[]` contract at the app layer
- direct path: try up to 3 product images in one Vertex request
- if runtime rejects multi-image count, fallback to sequential single-item chaining
- expose `pass_count` for diagnostics only

Important:

- user-facing charge must not depend on `pass_count`
- smoke output and route response must not disagree on charged credits

- [ ] **Step 5: Update the smoke script**

Adjust `scripts/smoke-try-on-vertex.py` so it verifies:

- selected-item-set request shape
- correct `credits_charged`
- non-empty preview image
- provider status

Do not assert a fixed `pass_count` when direct success and fallback can both be valid.

- [ ] **Step 6: Run tests again**

Run:

- `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test:unit -- tests/unit/try-on.test.ts`
- `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test:integration -- tests/integration/try-on-route.test.ts`
- `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run smoke:try-on:vertex`

Expected:

- unit PASS
- integration PASS
- smoke PASS, reported as `실제 Vertex 실착 생성+크레딧 smoke 통과`

---

### Task 6: Verification, Harness, And Regression Guards

**Files:**
- Modify: `AGENTS.md`
- Modify: `tests/e2e/onboarding.spec.ts`
- Modify: `tests/integration/feedback-route.test.ts`
- Modify: `tests/integration/try-on-route.test.ts`

- [ ] **Step 1: Add harness assertions for the new path**

Update `AGENTS.md` verification rules to explicitly require:

- selectable recommendation cards for result screen changes
- role-balanced recommendation verification
- selected-item try-on E2E
- try-on credit estimate vs actual charge consistency
- no overclaiming multi-item success if only one item was applied

- [ ] **Step 2: Add regression tests for prior failures**

Cover:

- system recommendation not collapsing into tops only
- try-on modal overlay filling the viewport
- credits updating immediately after charge
- selected combination reflected in preview summary

- [ ] **Step 3: Run final verification matrix**

Run in sequence, not parallel:

1. `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test:unit -- tests/unit/agents-contracts.test.ts tests/unit/recommendation-mix.test.ts tests/unit/try-on.test.ts`
2. `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test:integration -- tests/integration/feedback-route.test.ts tests/integration/try-on-route.test.ts`
3. `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test:e2e -- --grep "selective try-on"`
4. `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run visual:app`
5. `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run smoke:try-on:vertex`

Expected:

- no repeated preview spam or runaway `/api/closet/previews` requests in the result path
- credit deduction reflected in the active page state
- try-on result built from the selected combination, not a fixed legacy trio

---

## Execution Order

1. Task 1: contracts
2. Task 2: recommendation engine and library
3. Task 3: feedback route response
4. Task 4: result page UI/state
5. Task 5: try-on route and adapter
6. Task 6: harness/regression verification

## Notes For Implementation

- Current repo already contains partial groundwork in `lib/product/recommendation-mix.ts`, `lib/product/system-style-library.ts`, `app/api/try-on/route.ts`, and `lib/agents/try-on.ts`. Do not rewrite these blindly; migrate them toward the new contract.
- Keep backward compatibility until the result page and route consumers are fully moved.
- Do not report “실착 전체 조합 적용” unless the selected items actually flow into the provider request and the smoke/E2E path verifies the selected set.
- The direct-vs-fallback provider distinction is an internal reliability detail. The user-visible contract is selected items in, charged by selected item count, preview out.
