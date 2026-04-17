# Closet Source ID Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent unverified model-returned `source_item_ids` from being displayed as direct closet matches.

**Architecture:** Add a focused sanitizer in `lib/agents/contracts.ts`, call it in `/api/feedback` after provider output, and verify with unit, integration, and E2E tests. UI fallback behavior remains in `buildClosetBasisMatches`.

**Tech Stack:** Next.js Route Handler, TypeScript, Vitest, Playwright.

---

### Task 1: Source ID Sanitizer

**Files:**
- Modify: `lib/agents/contracts.ts`
- Test: `tests/unit/agent-contracts.test.ts`

- [ ] **Step 1: Write the failing unit test**

Add a test that calls `sanitizeSourceItemIdsForCloset` with valid, missing, wrong-category, and blank ids.

- [ ] **Step 2: Run the unit test**

Run: `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test:unit -- tests/unit/agent-contracts.test.ts`

Expected: fail because `sanitizeSourceItemIdsForCloset` is not exported yet.

- [ ] **Step 3: Implement the sanitizer**

Export `sanitizeSourceItemIdsForCloset(sourceItemIds, closetItems)` from `lib/agents/contracts.ts`.
Keep only ids where the same id exists in `closetItems` with the same category.
Return `undefined` if no valid ids remain.

- [ ] **Step 4: Run the unit test again**

Run: `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test:unit -- tests/unit/agent-contracts.test.ts`

Expected: pass.

### Task 2: Feedback Route Enforcement

**Files:**
- Modify: `app/api/feedback/route.ts`
- Test: `tests/integration/feedback-route.test.ts`

- [ ] **Step 1: Write the failing integration test**

Mock the provider to return `source_item_ids` containing one wrong-category id and one missing id. Assert `/api/feedback` removes both.

- [ ] **Step 2: Run the integration test**

Run: `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test:integration -- tests/integration/feedback-route.test.ts`

Expected: fail because the route still returns unverified provider ids.

- [ ] **Step 3: Apply sanitizer in route**

After provider feedback is returned, replace `recommended_outfit.source_item_ids` with `sanitizeSourceItemIdsForCloset(feedback.recommended_outfit.source_item_ids, payload.closet_items)`.

- [ ] **Step 4: Run the integration test again**

Run: `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test:integration -- tests/integration/feedback-route.test.ts`

Expected: pass.

### Task 3: E2E Fallback Behavior

**Files:**
- Modify: `tests/e2e/onboarding.spec.ts`
- Docs: `docs/product/closet-recommendation-basis.md`, `docs/product/mvp-critical-path.md`, `AGENTS.md`

- [ ] **Step 1: Add E2E expectation**

Seed a result with an invalid `source_item_ids` and assert direct matching is not shown for that invalid id path.

- [ ] **Step 2: Update docs**

Document that direct match means “validated source id in the current closet”.

- [ ] **Step 3: Run verification**

Run the non-parallel checks: typecheck, lint, unit, integration, harness, E2E, visual, build.
