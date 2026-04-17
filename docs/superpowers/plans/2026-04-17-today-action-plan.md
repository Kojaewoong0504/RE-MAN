# Today Action Plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the result page's single `today_action` as a compact 3-step execution card.

**Architecture:** Add a pure product helper that builds three display steps from `today_action` and `recommended_outfit.items`, then render it in the existing result hero card.

**Tech Stack:** TypeScript, React, Vitest, Playwright E2E, Tailwind CSS.

---

### Task 1: Failing Tests

**Files:**
- Create: `tests/unit/today-action-plan.test.ts`
- Modify: `tests/e2e/onboarding.spec.ts`

- [ ] Add unit tests for the 3-step action plan helper.
- [ ] Add E2E assertions that the result page shows `오늘 실행 3단계`.
- [ ] Run targeted tests and confirm failure.

### Task 2: Helper And UI

**Files:**
- Create: `lib/product/today-action-plan.ts`
- Modify: `app/onboarding/result/page.tsx`
- Modify: `app/globals.css`

- [ ] Implement `buildTodayActionPlan`.
- [ ] Replace the plain `오늘 할 일` paragraph with a 3-step card.
- [ ] Keep the original `today_action` text visible as a short 기준 문장.

### Task 3: Docs And Verification

**Files:**
- Modify: `docs/product/style-check-session.md`
- Modify: `docs/index.md`

- [ ] Document that the result screen shows a 3-step action plan.
- [ ] Run typecheck, lint, unit, integration, full E2E, visual, build, and harness.
