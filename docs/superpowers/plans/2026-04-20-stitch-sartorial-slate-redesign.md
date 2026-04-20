# Stitch Sartorial Slate Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stitch `Sartorial Slate` 디자인 시스템을 기존 RE:MEN 앱 구조에 안전하게 이식한다.

**Architecture:** CSS token과 공통 utility class를 먼저 바꾸고, Home, Style, Result, Closet 화면의 레이아웃을 현재 상태/인증 로직을 유지한 채 조정한다. Stitch HTML은 레퍼런스로만 사용한다.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, Playwright visual smoke, Vitest.

---

### Task 1: Design Token Baseline

**Files:**
- Modify: `app/globals.css`
- Modify: `docs/design/design.md`

- [ ] Update CSS variables from warm olive to Sartorial Slate.
- [ ] Keep backwards-compatible variable names so existing components still compile.
- [ ] Update design doc with Stitch source and token direction.
- [ ] Run `npm run lint` and `npm run typecheck`.

### Task 2: Home and Style Screen Redesign

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/programs/style/page.tsx`
- Modify: `app/globals.css`
- Test: `tests/e2e/onboarding.spec.ts`

- [ ] Preserve existing links and labels used by E2E.
- [ ] Replace poster/card-heavy layout with editorial hero, score strip, and toned action surfaces.
- [ ] Run targeted onboarding E2E.

### Task 3: Result and Closet Visual Alignment

**Files:**
- Modify: `app/onboarding/result/page.tsx`
- Modify: `app/closet/page.tsx`
- Modify: `app/globals.css`
- Test: `tests/e2e/onboarding.spec.ts`

- [ ] Preserve result headings, credit badge, action dock, and closet editor behavior.
- [ ] Apply dark hero block and tonal basis/action surfaces.
- [ ] Run targeted onboarding E2E.

### Task 4: Full Verification

**Files:**
- No new production files expected.

- [ ] Run unit, integration, typecheck, lint, and harness checks.
- [ ] Run full onboarding E2E.
- [ ] Run `npm run visual:app` and inspect home/style/result/closet captures.
- [ ] Run `npm run build`.
- [ ] Commit after save gate passes.
