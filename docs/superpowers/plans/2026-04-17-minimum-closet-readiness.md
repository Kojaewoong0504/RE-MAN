# Minimum Closet Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require tops, bottoms, and shoes before style analysis starts.

**Architecture:** Add a small closet readiness helper in `lib/onboarding/storage.ts`, reuse it in upload and closet pages, and verify through unit and E2E tests.

**Tech Stack:** TypeScript, React/Next.js, Vitest, Playwright.

---

### Task 1: Readiness Helper

**Files:**
- Modify: `lib/onboarding/storage.ts`
- Test: `tests/unit/onboarding-storage.test.ts`

- [ ] **Step 1: Write failing unit test**

Add a test for `getMinimumClosetReadiness` where only tops is present. Expected `isReady: false`, present `tops`, missing `bottoms` and `shoes`.

- [ ] **Step 2: Run unit test**

Run: `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test:unit -- tests/unit/onboarding-storage.test.ts`

Expected: fail because helper is not implemented.

- [ ] **Step 3: Implement helper**

Export `getMinimumClosetReadiness(items)` from `lib/onboarding/storage.ts`.

### Task 2: UI Gate

**Files:**
- Modify: `app/onboarding/upload/page.tsx`
- Modify: `app/closet/page.tsx`
- Test: `tests/e2e/onboarding.spec.ts`

- [ ] **Step 1: Add E2E regression**

Seed/register only a top item on upload. Assert missing bottoms/shoes text is visible and `AI 분석 시작하기` is disabled.

- [ ] **Step 2: Implement UI**

Use readiness helper on upload and closet pages. Replace “1개 이상” logic with required category logic.

### Task 3: Docs And Verification

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/product/closet-management.md`
- Modify: `docs/product/mvp-critical-path.md`
- Modify: `harness/mvp/run.py`
- Modify: `docs/index.md`

- [ ] **Step 1: Document rule**

Document tops/bottoms/shoes minimum rule.

- [ ] **Step 2: Run verification**

Run typecheck, lint, unit, integration, harness, E2E, visual, and build.
