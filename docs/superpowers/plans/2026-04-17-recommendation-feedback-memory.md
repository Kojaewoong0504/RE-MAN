# Recommendation Feedback Memory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show users how saved recommendation feedback becomes the next recommendation context.

**Architecture:** Add a pure storage helper that converts `RecommendationFeedback` into short user-facing memory rows, then reuse it in result and upload screens.

**Tech Stack:** TypeScript, React state, Vitest unit tests, Playwright E2E.

---

### Task 1: Failing Tests

**Files:**
- Modify: `tests/unit/onboarding-storage.test.ts`
- Modify: `tests/e2e/onboarding.spec.ts`

- [ ] Add unit tests for user-facing feedback memory rows.
- [ ] Add E2E assertions for result save and upload memory display.
- [ ] Run targeted tests and confirm failure.

### Task 2: Storage Helper And UI

**Files:**
- Modify: `lib/onboarding/storage.ts`
- Modify: `app/onboarding/result/page.tsx`
- Modify: `app/onboarding/upload/page.tsx`
- Modify: `app/globals.css`

- [ ] Export a helper that returns short memory rows from `RecommendationFeedback`.
- [ ] Render the rows after recommendation feedback save.
- [ ] Render the rows in upload memory card before history preview.

### Task 3: Docs And Verification

**Files:**
- Modify: `docs/product/recommendation-feedback.md`
- Modify: `docs/index.md`

- [ ] Document the visible memory summary.
- [ ] Run typecheck, lint, unit, integration, full E2E, visual, build, and harness.
