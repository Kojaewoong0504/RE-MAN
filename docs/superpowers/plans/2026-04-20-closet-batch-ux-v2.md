# Closet Batch UX v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add visible batch/review status summaries so closet bulk registration is easier to operate for many garments.

**Architecture:** Keep the existing `/closet/batch` -> `/closet/review` flow. Add pure summary helpers in `lib/closet/batch.ts`, then render the same summary contract in `BatchCaptureClient` and `ClosetDraftReviewClient`.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Vitest, Playwright.

---

### Task 1: Draft Summary Helper

**Files:**
- Modify: `lib/closet/batch.ts`
- Test: `tests/unit/closet-batch.test.ts`

- [ ] Add failing unit tests for selected, analyzable, review, saveable, deleted counts.
- [ ] Implement `getClosetBatchSummary(drafts)`.
- [ ] Run `npm run test:unit -- --run tests/unit/closet-batch.test.ts`.

### Task 2: Batch Screen Summary

**Files:**
- Modify: `components/closet/BatchCaptureClient.tsx`
- Modify: `app/globals.css`
- Test: `tests/e2e/onboarding.spec.ts`

- [ ] Add failing E2E assertion for `선택됨`, `분석 대기`, `확인 필요`, `제외`.
- [ ] Render summary metrics above upload actions.
- [ ] Make CTA move to review when no analyzable draft remains but reviewable drafts exist.
- [ ] Run targeted Playwright test for closet batch summary.

### Task 3: Review Screen Summary

**Files:**
- Modify: `components/closet/ClosetDraftReviewClient.tsx`
- Modify: `app/globals.css`
- Test: `tests/e2e/onboarding.spec.ts`

- [ ] Add failing E2E assertion for `저장 가능`, `확인 필요`, `제외`.
- [ ] Render summary metrics above draft cards.
- [ ] Keep save disabled when saveable count is zero.
- [ ] Run targeted Playwright test for closet review summary.

### Task 4: Verification

**Files:**
- Verify only.

- [ ] Run `npm run typecheck`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run visual:app` and inspect `mobile-closet-batch.png` and `mobile-closet-review.png`.
- [ ] Run `npm run build`.
