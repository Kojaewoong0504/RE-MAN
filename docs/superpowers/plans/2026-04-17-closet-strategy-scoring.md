# Closet Strategy Scoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `closet_strategy` prefer reliable closet items and demote weak/caution items deterministically.

**Architecture:** Keep strategy generation in `lib/onboarding/storage.ts`, add a focused scoring helper, expose optional `score` on strategy items, and verify through unit and E2E payload checks.

**Tech Stack:** TypeScript, Vitest, Playwright, existing Next.js local storage onboarding flow.

---

### Task 1: Scoring Contract

**Files:**
- Modify: `lib/agents/contracts.ts`
- Modify: `lib/onboarding/storage.ts`
- Test: `tests/unit/onboarding-storage.test.ts`

- [ ] **Step 1: Write failing unit test**

Add a case where a clean but rarely worn item is not `core`, a well-fitting frequently worn item is `core`, and a poor-condition item is `use_with_care`.

- [ ] **Step 2: Run unit test**

Run: `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test:unit -- tests/unit/onboarding-storage.test.ts`

Expected: fail because current keyword logic marks clean rarely worn items as `core` and does not expose scores.

- [ ] **Step 3: Implement scoring**

Add `getClosetStrategyScore(item)` and use score thresholds to assign `core/use_with_care/optional`.
Add optional `score` to `ClosetStrategyItem`.

- [ ] **Step 4: Re-run unit test**

Run: `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test:unit -- tests/unit/onboarding-storage.test.ts`

Expected: pass.

### Task 2: Payload Regression

**Files:**
- Modify: `tests/e2e/onboarding.spec.ts`
- Docs: `docs/product/closet-management.md`, `AGENTS.md`

- [ ] **Step 1: Add E2E payload assertions**

Assert the analysis payload includes strategy scores and does not classify a low-frequency clean item as `core`.

- [ ] **Step 2: Update docs**

Document that frequency, fit, condition, and season affect strategy role.

- [ ] **Step 3: Full verification**

Run typecheck, lint, unit, integration, harness, E2E, visual, and build sequentially where required.
