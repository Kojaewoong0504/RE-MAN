# Result Density Reduction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compress the style result first screen so users see the outfit, today's action, and closet basis summary before optional details.

**Architecture:** Keep the existing result page component and storage model. Add local disclosure state for diagnosis/reason and closet basis detail, then update E2E expectations and product docs.

**Tech Stack:** Next.js App Router, React state, Playwright E2E, Tailwind CSS via `app/globals.css`.

---

### Task 1: Failing E2E For Result Density

**Files:**
- Modify: `tests/e2e/onboarding.spec.ts`

- [ ] **Step 1: Require collapsed diagnosis and basis detail**

Add expectations after result navigation:

```ts
await expect(page.getByText("청바지 + 무지 티셔츠 중심의 코디라")).toHaveCount(0);
await expect(page.getByText("새로 사기보다 지금 가진 옷")).toHaveCount(0);
await expect(page.getByText(/자주 입고 잘 맞음|후보/).first()).toHaveCount(0);
await page.getByRole("button", { name: /진단과 이유 보기/ }).click();
await expect(page.getByText("청바지 + 무지 티셔츠 중심의 코디라")).toBeVisible();
await expect(page.getByText("새로 사기보다 지금 가진 옷")).toBeVisible();
await page.getByRole("button", { name: /근거 자세히 보기/ }).click();
await expect(page.getByText(/자주 입고 잘 맞음|후보/).first()).toBeVisible();
```

- [ ] **Step 2: Run the test and confirm failure**

Run: `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test:e2e -- tests/e2e/onboarding.spec.ts -g "onboarding flow captures input and renders feedback"`

Expected: FAIL because the new disclosure buttons do not exist yet.

### Task 2: Result Page Disclosure UI

**Files:**
- Modify: `app/onboarding/result/page.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Add disclosure state**

Add:

```ts
const [showResultDetails, setShowResultDetails] = useState(false);
const [showBasisDetails, setShowBasisDetails] = useState(false);
```

- [ ] **Step 2: Remove diagnosis and reason from default view**

Render `feedback.diagnosis` and `feedback.recommended_outfit.reason` only inside a collapsible panel opened by `진단과 이유 보기`.

- [ ] **Step 3: Add compact basis chips**

Render the default closet basis as compact chips with category, item name, and status label only.

- [ ] **Step 4: Move detailed basis cards behind a button**

Render signal label and detail label only when `showBasisDetails` is true.

- [ ] **Step 5: Run the targeted E2E**

Run: `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test:e2e -- tests/e2e/onboarding.spec.ts -g "onboarding flow captures input and renders feedback"`

Expected: PASS.

### Task 3: Docs And Verification

**Files:**
- Modify: `docs/product/style-check-session.md`
- Modify: `docs/index.md`

- [ ] **Step 1: Update product UX rules**

State that diagnosis, recommendation reason, and basis details are collapsed by default.

- [ ] **Step 2: Run full verification**

Run:

```bash
PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run typecheck
PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run lint
PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test:unit
PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test:e2e -- tests/e2e/onboarding.spec.ts
PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run visual:app
PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run build
```

Expected: all pass. `visual:app` must be inspected for `mobile-result.png`.
