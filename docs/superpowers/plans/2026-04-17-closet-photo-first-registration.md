# Closet Photo-First Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make closet registration start with photo and category, while keeping optional metadata available behind a disclosure.

**Architecture:** Keep `ClosetInventoryEditor` as the registration boundary. Add local disclosure state for optional fields and update E2E helpers to open metadata only when a test needs it.

**Tech Stack:** Next.js, React state, Playwright E2E, Tailwind CSS in `app/globals.css`.

---

### Task 1: Failing E2E

**Files:**
- Modify: `tests/e2e/onboarding.spec.ts`

- [ ] Add expectations that a new closet modal hides optional fields by default.
- [ ] Add expectation that `선택 정보 열기` reveals `아이템 이름`.
- [ ] Add a save path where a photo and category alone creates an item.
- [ ] Run `npm run test:e2e -- tests/e2e/onboarding.spec.ts -g "closet page saves items"` and confirm failure.

### Task 2: Photo-First Modal

**Files:**
- Modify: `components/closet/ClosetInventoryEditor.tsx`
- Modify: `app/globals.css`

- [ ] Add `showOptionalDetails` state.
- [ ] Set `showOptionalDetails` to `false` for new items and `true` for edit.
- [ ] Move name/color/fit/size/status fields behind a disclosure.
- [ ] Make the photo chooser visually primary.
- [ ] Keep `canAdd` based on `photoDataUrl`.

### Task 3: Verification

**Files:**
- Modify: `docs/product/closet-management.md`
- Modify: `docs/index.md`

- [ ] Document photo-first registration.
- [ ] Run typecheck, lint, unit, integration, full onboarding E2E, visual app, build, and harness.
