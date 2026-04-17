# Closet Basis Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Style Check 결과 화면에서 추천 조합이 내 옷장 아이템을 얼마나 반영했는지 첫 화면에 짧게 보여준다.

**Architecture:** 기존 provider 계약과 payload는 유지한다. `lib/product/closet-basis.ts`에 first-screen summary helper를 추가하고, `app/onboarding/result/page.tsx`에서 이를 렌더링한다.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, Playwright, local onboarding state.

---

### Task 1: Closet Basis Summary Helper

**Files:**
- Modify: `lib/product/closet-basis.ts`
- Test: `tests/unit/closet-basis.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { buildClosetBasisSummary } from "@/lib/product/closet-basis";

const summary = buildClosetBasisSummary([
  {
    category: "tops",
    label: "상의",
    itemName: "흰색 무지 티셔츠",
    role: "얼굴 주변 인상을 정하는 기준",
    matchStatus: "matched",
    statusLabel: "추천에 사용",
    signalLabel: "자주 입고 잘 맞음",
    detailLabel: "L · 잘 맞음"
  },
  {
    category: "bottoms",
    label: "하의",
    itemName: "검정 슬랙스",
    role: "전체 비율과 실루엣 기준",
    matchStatus: "matched",
    statusLabel: "추천에 사용",
    signalLabel: "후보",
    detailLabel: "32"
  },
  {
    category: "shoes",
    label: "신발",
    itemName: "흰색 스니커즈",
    role: "코디가 흩어지지 않게 묶는 기준",
    matchStatus: "fallback",
    statusLabel: "비슷한 후보",
    signalLabel: "후보",
    detailLabel: "270"
  }
]);

expect(summary).toEqual({
  countLabel: "상의 · 하의 · 신발 중 2개 반영",
  reasonLabel: "흰색 무지 티셔츠 중심으로 시작"
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test:unit -- tests/unit/closet-basis.test.ts`

Expected: FAIL because `buildClosetBasisSummary` is not exported.

- [ ] **Step 3: Implement minimal helper**

Add `buildClosetBasisSummary(basis: ClosetBasisItem[])` that counts `matched` among tops/bottoms/shoes and returns a short reason from the first matched item, falling back to the first basis item.

- [ ] **Step 4: Run unit test**

Run: `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test:unit -- tests/unit/closet-basis.test.ts`

Expected: PASS.

### Task 2: Result UI Connection

**Files:**
- Modify: `app/onboarding/result/page.tsx`
- Modify: `app/globals.css`
- Test: `tests/e2e/onboarding.spec.ts`

- [ ] **Step 1: Write the failing E2E assertion**

In the main onboarding E2E result assertions, expect:

```ts
await expect(page.getByRole("heading", { name: "내 옷장에서 쓴 것" })).toBeVisible();
await expect(page.getByText(/상의 · 하의 · 신발 중 \d개 반영/)).toBeVisible();
await expect(page.getByText(/흰색 무지 티셔츠 중심으로 시작/)).toBeVisible();
```

- [ ] **Step 2: Run targeted E2E to verify it fails**

Run: `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test:e2e -- tests/e2e/onboarding.spec.ts -g "onboarding flow captures input and renders feedback"`

Expected: FAIL because the new summary UI is not rendered.

- [ ] **Step 3: Render summary**

Import `buildClosetBasisSummary`, compute it from `closetBasis`, render a compact summary block above chips, and rename heading to `내 옷장에서 쓴 것`.

- [ ] **Step 4: Run targeted E2E**

Run: `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test:e2e -- tests/e2e/onboarding.spec.ts -g "onboarding flow captures input and renders feedback"`

Expected: PASS.

### Task 3: Verification

**Files:**
- No additional production edits expected.

- [ ] **Step 1: Run non-visual checks**

Run unit, integration, typecheck, lint, and harness checks.

- [ ] **Step 2: Run locked checks sequentially**

Run full onboarding E2E, `npm run visual:app`, inspect result screenshots, then `npm run build`.

- [ ] **Step 3: Commit**

Commit message: `feat: clarify closet basis on result`
