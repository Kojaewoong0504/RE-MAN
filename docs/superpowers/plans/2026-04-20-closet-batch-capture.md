# Closet Batch Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fast closet batch capture flow where users add multiple garment photos, receive AI-generated item drafts, review/edit/delete drafts, and save confirmed items into the existing closet.

**Architecture:** Add a draft layer separate from confirmed `ClosetItem` records, then expose a provider-backed `/api/closet/analyze` endpoint. The UI is split into `/closet/batch` for capture/analysis and `/closet/review` for confirmation, with existing closet storage only updated after review.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Vitest, Playwright, existing onboarding localStorage and Firestore profile sync.

---

## File Structure

- Create `lib/closet/batch.ts`: draft types, draft normalization, confidence threshold, draft-to-item conversion.
- Create `lib/closet/analysis-provider.ts`: provider interface, mock provider, response normalization, provider selector.
- Create `app/api/closet/analyze/route.ts`: authenticated route for one-image closet draft analysis.
- Create `components/closet/BatchCaptureClient.tsx`: multi-image selection, draft queue, analysis calls, navigation to review.
- Create `components/closet/ClosetDraftReviewClient.tsx`: draft review, inline edits, delete, save confirmed items.
- Create `app/closet/batch/page.tsx`: protected batch capture entry.
- Create `app/closet/review/page.tsx`: protected review entry.
- Modify `lib/onboarding/storage.ts`: persist batch drafts in `OnboardingState` without mixing them into confirmed `closet_items`.
- Modify `components/closet/ClosetInventoryEditor.tsx`: make `+` open a mode chooser instead of immediately opening the single-item modal.
- Modify `app/closet/page.tsx`: connect quick capture CTA and keep one-item registration available.
- Modify `scripts/visual-app-smoke.mjs`: capture `/closet/batch` and `/closet/review`.
- Modify `tests/e2e/onboarding.spec.ts`: cover three draft uploads, one edit, one delete, one save.
- Create `tests/unit/closet-batch.test.ts`.
- Create `tests/unit/closet-analysis-provider.test.ts`.
- Create `tests/integration/closet-analyze-route.test.ts`.

---

## Task 1: Draft Model And Conversion

**Files:**
- Create: `lib/closet/batch.ts`
- Modify: `lib/onboarding/storage.ts`
- Test: `tests/unit/closet-batch.test.ts`

- [ ] **Step 1: Write failing unit tests for draft conversion**

Create `tests/unit/closet-batch.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  CONFIDENCE_REVIEW_THRESHOLD,
  draftToClosetItem,
  normalizeClosetDraft,
  selectSaveableDrafts
} from "@/lib/closet/batch";

const photo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB";

describe("closet batch drafts", () => {
  it("keeps low confidence drafts in needs_review", () => {
    const draft = normalizeClosetDraft({
      id: "draft-1",
      photo_data_url: photo,
      analysis_status: "analyzing",
      category: "tops",
      name: "네이비 셔츠",
      analysis_confidence: CONFIDENCE_REVIEW_THRESHOLD - 0.01
    });

    expect(draft.analysis_status).toBe("needs_review");
  });

  it("converts confirmed draft to ClosetItem without trusting unknown size", () => {
    const item = draftToClosetItem({
      id: "draft-1",
      photo_data_url: photo,
      analysis_status: "confirmed",
      category: "tops",
      name: "네이비 셔츠",
      color: "네이비",
      detected_type: "셔츠",
      fit: "레귤러",
      season: "봄/가을",
      condition: "깨끗함",
      size: "L",
      size_source: "unknown",
      size_confidence: 0
    });

    expect(item).toMatchObject({
      category: "tops",
      name: "네이비 셔츠",
      color: "네이비",
      fit: "레귤러",
      season: "봄/가을",
      condition: "깨끗함",
      size: ""
    });
  });

  it("excludes failed and deleted drafts from saveable drafts", () => {
    const drafts = selectSaveableDrafts([
      {
        id: "draft-1",
        photo_data_url: photo,
        analysis_status: "confirmed",
        category: "tops",
        name: "흰 티셔츠"
      },
      {
        id: "draft-2",
        photo_data_url: photo,
        analysis_status: "failed",
        category: "bottoms",
        name: "청바지"
      },
      {
        id: "draft-3",
        photo_data_url: photo,
        analysis_status: "confirmed",
        deleted: true,
        category: "shoes",
        name: "스니커즈"
      }
    ]);

    expect(drafts.map((draft) => draft.id)).toEqual(["draft-1"]);
  });
});
```

- [ ] **Step 2: Run the failing unit test**

Run:

```bash
npm run test:unit -- tests/unit/closet-batch.test.ts
```

Expected: FAIL because `@/lib/closet/batch` does not exist.

- [ ] **Step 3: Add draft types and conversion helpers**

Create `lib/closet/batch.ts`:

```ts
import type { ClosetItem, ClosetItemCategory } from "@/lib/onboarding/storage";

export const CONFIDENCE_REVIEW_THRESHOLD = 0.7;

export type ClosetAnalysisStatus =
  | "pending"
  | "analyzing"
  | "needs_review"
  | "confirmed"
  | "failed";

export type ClosetSizeSource =
  | "manual"
  | "label_ocr"
  | "measurement_estimate"
  | "unknown";

export type ClosetItemDraft = {
  id: string;
  photo_data_url: string;
  analysis_status: ClosetAnalysisStatus;
  category?: ClosetItemCategory;
  name?: string;
  color?: string;
  detected_type?: string;
  fit?: string;
  season?: string;
  condition?: string;
  size?: string;
  analysis_confidence?: number;
  size_source?: ClosetSizeSource;
  size_confidence?: number;
  error_message?: string;
  deleted?: boolean;
};

const categories: ClosetItemCategory[] = ["tops", "bottoms", "shoes", "outerwear"];

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCategory(value: unknown): ClosetItemCategory | undefined {
  return categories.includes(value as ClosetItemCategory)
    ? (value as ClosetItemCategory)
    : undefined;
}

function normalizeConfidence(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : 0;
}

export function normalizeClosetDraft(input: Partial<ClosetItemDraft>): ClosetItemDraft {
  const confidence = normalizeConfidence(input.analysis_confidence);
  const status =
    input.analysis_status === "failed"
      ? "failed"
      : confidence >= CONFIDENCE_REVIEW_THRESHOLD
        ? "confirmed"
        : "needs_review";

  return {
    id: clean(input.id) || `draft-${Date.now()}`,
    photo_data_url: clean(input.photo_data_url),
    analysis_status: status,
    category: normalizeCategory(input.category),
    name: clean(input.name),
    color: clean(input.color),
    detected_type: clean(input.detected_type),
    fit: clean(input.fit),
    season: clean(input.season),
    condition: clean(input.condition),
    size: clean(input.size),
    analysis_confidence: confidence,
    size_source: input.size_source ?? "unknown",
    size_confidence: normalizeConfidence(input.size_confidence),
    error_message: clean(input.error_message),
    deleted: Boolean(input.deleted)
  };
}

export function selectSaveableDrafts(drafts: ClosetItemDraft[]) {
  return drafts.filter(
    (draft) =>
      !draft.deleted &&
      draft.analysis_status === "confirmed" &&
      Boolean(draft.category) &&
      Boolean(draft.name?.trim())
  );
}

export function draftToClosetItem(draft: ClosetItemDraft): ClosetItem {
  return {
    id: `closet-${draft.id}`,
    category: draft.category ?? "tops",
    name: draft.name?.trim() || draft.detected_type?.trim() || "옷장 사진",
    photo_data_url: draft.photo_data_url,
    color: draft.color?.trim() ?? "",
    fit: draft.fit?.trim() ?? "",
    size:
      draft.size_source === "manual" ||
      draft.size_source === "label_ocr" ||
      draft.size_source === "measurement_estimate"
        ? draft.size?.trim() ?? ""
        : "",
    season: draft.season?.trim() ?? "",
    condition: draft.condition?.trim() ?? "",
    notes: draft.detected_type?.trim() ? `AI 초안: ${draft.detected_type.trim()}` : ""
  };
}
```

- [ ] **Step 4: Add draft state to onboarding storage**

Modify `lib/onboarding/storage.ts`:

```ts
import type { ClosetItemDraft } from "@/lib/closet/batch";
```

Extend `OnboardingState`:

```ts
export type OnboardingState = OnboardingInput & {
  user_id?: string;
  email?: string;
  size_profile?: SizeProfile;
  closet_item_drafts?: ClosetItemDraft[];
  feedback?: OnboardingAgentResponse;
  daily_feedbacks?: Record<string, DailyAgentResponse>;
  deep_dive_feedbacks?: Partial<Record<DeepDiveModule, DeepDiveResponse>>;
  try_on_previews?: Record<string, TryOnPreviewCacheEntry>;
  recommendation_feedback?: RecommendationFeedback;
  feedback_history?: FeedbackHistoryItem[];
  fallback_message?: string;
};
```

In `readOnboardingState`, normalize parsed drafts with:

```ts
closet_item_drafts: Array.isArray(parsed.closet_item_drafts)
  ? parsed.closet_item_drafts.map((draft) => normalizeClosetDraft(draft))
  : [],
```

In `patchOnboardingState`, preserve draft patches:

```ts
closet_item_drafts:
  patch.closet_item_drafts !== undefined
    ? patch.closet_item_drafts.map((draft) => normalizeClosetDraft(draft))
    : current.closet_item_drafts?.map((draft) => normalizeClosetDraft(draft)) ?? [],
```

- [ ] **Step 5: Run unit tests**

Run:

```bash
npm run test:unit -- tests/unit/closet-batch.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/closet/batch.ts lib/onboarding/storage.ts tests/unit/closet-batch.test.ts
git commit -m "feat: add closet batch draft model"
```

---

## Task 2: Closet Analysis Provider And API Route

**Files:**
- Create: `lib/closet/analysis-provider.ts`
- Create: `app/api/closet/analyze/route.ts`
- Test: `tests/unit/closet-analysis-provider.test.ts`
- Test: `tests/integration/closet-analyze-route.test.ts`

- [ ] **Step 1: Write provider unit tests**

Create `tests/unit/closet-analysis-provider.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { analyzeClosetImage, normalizeClosetAnalysis } from "@/lib/closet/analysis-provider";

const image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB";

describe("closet analysis provider", () => {
  it("normalizes invalid provider fields to safe unknown size", () => {
    const result = normalizeClosetAnalysis({
      category: "invalid",
      name: "  네이비 셔츠  ",
      color: " 네이비 ",
      analysis_confidence: 2,
      size: "L",
      size_source: "unknown",
      size_confidence: 0.9
    });

    expect(result).toMatchObject({
      category: undefined,
      name: "네이비 셔츠",
      color: "네이비",
      analysis_confidence: 1,
      size: "",
      size_source: "unknown",
      size_confidence: 0
    });
  });

  it("returns deterministic mock analysis", async () => {
    const result = await analyzeClosetImage({ image, provider: "mock" });

    expect(result.name).toBeTruthy();
    expect(result.size_source).toBe("unknown");
    expect(result.size).toBe("");
  });
});
```

- [ ] **Step 2: Write route integration tests**

Create `tests/integration/closet-analyze-route.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/closet/analyze/route";

vi.mock("@/lib/auth/session", () => ({
  getServerSession: vi.fn(async () => ({
    user: {
      uid: "test-user",
      email: "test@example.com",
      name: "Test User",
      picture: null,
      provider: "google"
    }
  }))
}));

const image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB";

describe("POST /api/closet/analyze", () => {
  it("returns mock closet analysis draft", async () => {
    const response = await POST(
      new Request("http://localhost/api/closet/analyze", {
        method: "POST",
        body: JSON.stringify({ image })
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      size: "",
      size_source: "unknown"
    });
    expect(body.category).toBeTruthy();
  });

  it("rejects missing image", async () => {
    const response = await POST(
      new Request("http://localhost/api/closet/analyze", {
        method: "POST",
        body: JSON.stringify({})
      })
    );

    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 3: Run failing tests**

Run:

```bash
npm run test:unit -- tests/unit/closet-analysis-provider.test.ts
npm run test:integration -- tests/integration/closet-analyze-route.test.ts
```

Expected: FAIL because provider and route do not exist.

- [ ] **Step 4: Implement provider**

Create `lib/closet/analysis-provider.ts`:

```ts
import type { ClosetItemCategory } from "@/lib/onboarding/storage";

export type ClosetAnalysisProvider = "mock" | "gemini";

export type ClosetAnalysisResult = {
  category?: ClosetItemCategory;
  name: string;
  color: string;
  detected_type: string;
  fit: string;
  season: string;
  condition: string;
  analysis_confidence: number;
  size: string;
  size_source: "manual" | "label_ocr" | "measurement_estimate" | "unknown";
  size_confidence: number;
};

const categories: ClosetItemCategory[] = ["tops", "bottoms", "shoes", "outerwear"];

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function clampConfidence(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : 0;
}

function normalizeCategory(value: unknown) {
  return categories.includes(value as ClosetItemCategory)
    ? (value as ClosetItemCategory)
    : undefined;
}

export function normalizeClosetAnalysis(input: Partial<ClosetAnalysisResult>) {
  const sizeSource = input.size_source ?? "unknown";

  return {
    category: normalizeCategory(input.category),
    name: clean(input.name),
    color: clean(input.color),
    detected_type: clean(input.detected_type),
    fit: clean(input.fit),
    season: clean(input.season),
    condition: clean(input.condition),
    analysis_confidence: clampConfidence(input.analysis_confidence),
    size: sizeSource === "unknown" ? "" : clean(input.size),
    size_source: sizeSource,
    size_confidence: sizeSource === "unknown" ? 0 : clampConfidence(input.size_confidence)
  };
}

function getProvider(input?: ClosetAnalysisProvider): ClosetAnalysisProvider {
  if (input) {
    return input;
  }

  return process.env.CLOSET_ANALYSIS_PROVIDER === "gemini" ? "gemini" : "mock";
}

async function analyzeWithMock() {
  return normalizeClosetAnalysis({
    category: "tops",
    name: "네이비 셔츠",
    color: "네이비",
    detected_type: "셔츠",
    fit: "레귤러",
    season: "봄/가을",
    condition: "깨끗함",
    analysis_confidence: 0.82,
    size: "",
    size_source: "unknown",
    size_confidence: 0
  });
}

export async function analyzeClosetImage({
  image,
  provider
}: {
  image: string;
  provider?: ClosetAnalysisProvider;
}) {
  if (!image.startsWith("data:image/")) {
    throw new Error("invalid_image");
  }

  const selectedProvider = getProvider(provider);

  if (selectedProvider === "mock") {
    return analyzeWithMock();
  }

  throw new Error("gemini_closet_analysis_not_enabled");
}
```

- [ ] **Step 5: Implement API route**

Create `app/api/closet/analyze/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { analyzeClosetImage } from "@/lib/closet/analysis-provider";

export async function POST(request: Request) {
  const session = await getServerSession();

  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { image?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (typeof body.image !== "string" || !body.image.startsWith("data:image/")) {
    return NextResponse.json({ error: "invalid_image" }, { status: 400 });
  }

  try {
    const result = await analyzeClosetImage({ image: body.image });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "analysis_failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
```

- [ ] **Step 6: Run tests**

Run:

```bash
npm run test:unit -- tests/unit/closet-analysis-provider.test.ts
npm run test:integration -- tests/integration/closet-analyze-route.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/closet/analysis-provider.ts app/api/closet/analyze/route.ts tests/unit/closet-analysis-provider.test.ts tests/integration/closet-analyze-route.test.ts
git commit -m "feat: add closet analysis api"
```

---

## Task 3: Batch Capture Page

**Files:**
- Create: `components/closet/BatchCaptureClient.tsx`
- Create: `app/closet/batch/page.tsx`
- Modify: `app/globals.css`
- Test: `tests/e2e/onboarding.spec.ts`

- [ ] **Step 1: Add E2E skeleton for batch capture page**

Append a test to `tests/e2e/onboarding.spec.ts`:

```ts
test("closet batch capture accepts multiple photos and creates review drafts", async ({ page }) => {
  await seedLoggedInUser(page);
  await page.goto("/closet/batch");

  await expect(page.getByRole("heading", { name: "빠른 옷장 등록" })).toBeVisible();
  await expect(page.getByText("여러 장을 한 번에 추가하세요")).toBeVisible();
});
```

Use the existing auth seeding helper in that file. If the helper has a different name, reuse the file's existing login/session helper instead of adding a second auth mechanism.

- [ ] **Step 2: Run E2E and verify failure**

Run:

```bash
npm run test:e2e -- tests/e2e/onboarding.spec.ts
```

Expected: FAIL because `/closet/batch` does not exist.

- [ ] **Step 3: Implement batch page route**

Create `app/closet/batch/page.tsx`:

```tsx
import Link from "next/link";
import { BatchCaptureClient } from "@/components/closet/BatchCaptureClient";
import { AccountAccessButton } from "@/components/common/AccountAccessButton";
import { BottomTabNav } from "@/components/common/BottomTabNav";

export default function ClosetBatchPage() {
  return (
    <main className="app-shell flex min-h-screen flex-col justify-between">
      <div className="poster-grid pt-6">
        <div className="app-header">
          <div className="flex items-center gap-4">
            <Link className="app-back-button" href="/closet">
              ←
            </Link>
            <div>
              <p className="app-brand">RE:MAN</p>
              <p className="app-subbrand">CLOSET CAPTURE</p>
            </div>
          </div>
          <AccountAccessButton />
        </div>
        <BatchCaptureClient />
      </div>
      <BottomTabNav />
    </main>
  );
}
```

- [ ] **Step 4: Implement batch client**

Create `components/closet/BatchCaptureClient.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { normalizeClosetDraft, type ClosetItemDraft } from "@/lib/closet/batch";
import { patchOnboardingState, readOnboardingState } from "@/lib/onboarding/storage";
import { validatePhotoFile } from "@/lib/upload/photo-input";

function createDraftId() {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("file_read_failed"));
    reader.readAsDataURL(file);
  });
}

export function BatchCaptureClient() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<ClosetItemDraft[]>(
    () => readOnboardingState().closet_item_drafts ?? []
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState("");

  async function handleFiles(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    setError("");
    const nextDrafts: ClosetItemDraft[] = [];

    for (const file of Array.from(files)) {
      const validation = validatePhotoFile(file);

      if (!validation.ok) {
        nextDrafts.push(
          normalizeClosetDraft({
            id: createDraftId(),
            photo_data_url: "",
            analysis_status: "failed",
            error_message: validation.message
          })
        );
        continue;
      }

      nextDrafts.push(
        normalizeClosetDraft({
          id: createDraftId(),
          photo_data_url: await readAsDataUrl(file),
          analysis_status: "pending"
        })
      );
    }

    const merged = [...drafts, ...nextDrafts];
    setDrafts(merged);
    patchOnboardingState({ closet_item_drafts: merged });
  }

  async function analyzeDrafts() {
    setIsAnalyzing(true);
    setError("");

    const analyzed: ClosetItemDraft[] = [];

    for (const draft of drafts) {
      if (!draft.photo_data_url || draft.analysis_status === "failed") {
        analyzed.push(draft);
        continue;
      }

      try {
        const response = await fetch("/api/closet/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: draft.photo_data_url })
        });

        if (!response.ok) {
          throw new Error("analysis_failed");
        }

        const result = await response.json();
        analyzed.push(
          normalizeClosetDraft({
            ...draft,
            ...result,
            analysis_status: "needs_review"
          })
        );
      } catch {
        analyzed.push(
          normalizeClosetDraft({
            ...draft,
            analysis_status: "failed",
            error_message: "분석 실패"
          })
        );
      }
    }

    setDrafts(analyzed);
    patchOnboardingState({ closet_item_drafts: analyzed });
    setIsAnalyzing(false);
    router.push("/closet/review");
  }

  return (
    <section className="closet-batch-screen">
      <div className="closet-batch-hero">
        <p className="poster-kicker">Batch Capture</p>
        <h1>빠른 옷장 등록</h1>
        <p>여러 장을 한 번에 추가하세요. AI가 초안을 만들고, 저장 전 확인만 합니다.</p>
      </div>

      <label className="closet-batch-dropzone">
        <span>사진 여러 장 선택</span>
        <input
          accept="image/*"
          className="sr-only"
          multiple
          onChange={(event) => void handleFiles(event.target.files)}
          type="file"
        />
      </label>

      {error ? <p className="text-sm font-black text-red-700">{error}</p> : null}

      <div className="closet-batch-grid">
        {drafts.map((draft) => (
          <article className="closet-batch-tile" key={draft.id}>
            {draft.photo_data_url ? (
              <img alt="옷장 등록 후보" src={draft.photo_data_url} />
            ) : (
              <div>이미지 오류</div>
            )}
            <p>{draft.analysis_status}</p>
          </article>
        ))}
      </div>

      <button
        className="ui-button-accent h-14 w-full"
        disabled={drafts.length === 0 || isAnalyzing}
        onClick={() => void analyzeDrafts()}
        type="button"
      >
        {isAnalyzing ? "분석 중" : "AI 초안 만들기"}
      </button>
    </section>
  );
}
```

- [ ] **Step 5: Add minimal styles**

Append to `app/globals.css`:

```css
  .closet-batch-screen {
    @apply space-y-6 pb-28;
  }

  .closet-batch-hero {
    @apply rounded-[2rem] p-6 text-white;
    background: linear-gradient(135deg, var(--color-ink), var(--color-accent));
  }

  .closet-batch-hero h1 {
    @apply mt-3 text-4xl font-black leading-none tracking-[-0.06em];
  }

  .closet-batch-hero p:last-child {
    @apply mt-3 text-sm font-bold leading-6 text-white/75;
  }

  .closet-batch-dropzone {
    @apply flex min-h-40 cursor-pointer items-center justify-center rounded-[2rem] text-sm font-black;
    background: var(--color-surface-raised);
    box-shadow: inset 0 0 0 1px rgba(5, 17, 37, 0.08);
  }

  .closet-batch-grid {
    @apply grid grid-cols-3 gap-3;
  }

  .closet-batch-tile {
    @apply overflow-hidden rounded-2xl text-center text-[11px] font-black uppercase text-muted;
    background: var(--color-surface-raised);
  }

  .closet-batch-tile img,
  .closet-batch-tile > div {
    @apply aspect-[3/4] w-full object-cover;
  }

  .closet-batch-tile p {
    @apply px-2 py-2;
  }
```

- [ ] **Step 6: Run checks**

Run:

```bash
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/closet/batch/page.tsx components/closet/BatchCaptureClient.tsx app/globals.css tests/e2e/onboarding.spec.ts
git commit -m "feat: add closet batch capture page"
```

---

## Task 4: Draft Review And Save

**Files:**
- Create: `components/closet/ClosetDraftReviewClient.tsx`
- Create: `app/closet/review/page.tsx`
- Modify: `app/globals.css`
- Test: `tests/e2e/onboarding.spec.ts`

- [ ] **Step 1: Extend E2E for review behavior**

Add to `tests/e2e/onboarding.spec.ts`:

```ts
test("closet review saves confirmed drafts and ignores deleted drafts", async ({ page }) => {
  await seedLoggedInUser(page);
  await page.goto("/closet/review");

  await page.evaluate(() => {
    window.localStorage.setItem(
      "reman:onboarding",
      JSON.stringify({
        survey: {},
        closet_item_drafts: [
          {
            id: "draft-top",
            photo_data_url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB",
            analysis_status: "confirmed",
            category: "tops",
            name: "네이비 셔츠",
            color: "네이비",
            analysis_confidence: 0.82,
            size_source: "unknown",
            size_confidence: 0
          },
          {
            id: "draft-bottom",
            photo_data_url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB",
            analysis_status: "needs_review",
            category: "bottoms",
            name: "청바지",
            color: "블루",
            analysis_confidence: 0.52,
            size_source: "unknown",
            size_confidence: 0
          },
          {
            id: "draft-shoes",
            photo_data_url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB",
            analysis_status: "confirmed",
            category: "shoes",
            name: "흰색 스니커즈",
            color: "흰색",
            analysis_confidence: 0.8,
            size_source: "unknown",
            size_confidence: 0
          }
        ]
      })
    );
  });
  await page.reload();

  await page.getByRole("button", { name: "청바지 수정" }).click();
  await page.getByLabel("이름").fill("연청 데님");
  await page.getByRole("button", { name: "수정 저장" }).click();
  await page.getByRole("button", { name: "흰색 스니커즈 삭제" }).click();
  await page.getByRole("button", { name: "옷장에 저장" }).click();

  await expect(page).toHaveURL(/\/closet$/);
  await expect(page.getByText("네이비 셔츠")).toBeVisible();
  await expect(page.getByText("연청 데님")).toBeVisible();
  await expect(page.getByText("흰색 스니커즈")).toHaveCount(0);
});
```

- [ ] **Step 2: Run E2E and verify failure**

Run:

```bash
npm run test:e2e -- tests/e2e/onboarding.spec.ts
```

Expected: FAIL because review UI does not exist.

- [ ] **Step 3: Implement review page**

Create `app/closet/review/page.tsx`:

```tsx
import Link from "next/link";
import { ClosetDraftReviewClient } from "@/components/closet/ClosetDraftReviewClient";
import { AccountAccessButton } from "@/components/common/AccountAccessButton";
import { BottomTabNav } from "@/components/common/BottomTabNav";

export default function ClosetReviewPage() {
  return (
    <main className="app-shell flex min-h-screen flex-col justify-between">
      <div className="poster-grid pt-6">
        <div className="app-header">
          <div className="flex items-center gap-4">
            <Link className="app-back-button" href="/closet/batch">
              ←
            </Link>
            <div>
              <p className="app-brand">RE:MAN</p>
              <p className="app-subbrand">REVIEW</p>
            </div>
          </div>
          <AccountAccessButton />
        </div>
        <ClosetDraftReviewClient />
      </div>
      <BottomTabNav />
    </main>
  );
}
```

- [ ] **Step 4: Implement review client**

Create `components/closet/ClosetDraftReviewClient.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  draftToClosetItem,
  selectSaveableDrafts,
  type ClosetItemDraft
} from "@/lib/closet/batch";
import {
  normalizeClosetItems,
  patchOnboardingState,
  readOnboardingState
} from "@/lib/onboarding/storage";

export function ClosetDraftReviewClient() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<ClosetItemDraft[]>(
    () => readOnboardingState().closet_item_drafts ?? []
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  function persist(nextDrafts: ClosetItemDraft[]) {
    setDrafts(nextDrafts);
    patchOnboardingState({ closet_item_drafts: nextDrafts });
  }

  function startEdit(draft: ClosetItemDraft) {
    setEditingId(draft.id);
    setEditName(draft.name ?? "");
  }

  function saveEdit() {
    const nextDrafts = drafts.map((draft) =>
      draft.id === editingId
        ? {
            ...draft,
            name: editName.trim() || draft.name,
            analysis_status: "confirmed" as const
          }
        : draft
    );
    persist(nextDrafts);
    setEditingId(null);
    setEditName("");
  }

  function removeDraft(id: string) {
    persist(drafts.map((draft) => (draft.id === id ? { ...draft, deleted: true } : draft)));
  }

  function saveToCloset() {
    const current = readOnboardingState();
    const existingItems = normalizeClosetItems(current.closet_items);
    const nextItems = [
      ...existingItems,
      ...selectSaveableDrafts(drafts).map(draftToClosetItem)
    ];

    patchOnboardingState({
      closet_items: nextItems,
      closet_item_drafts: []
    });
    router.push("/closet");
  }

  const visibleDrafts = drafts.filter((draft) => !draft.deleted);

  return (
    <section className="closet-review-screen">
      <div className="closet-batch-hero">
        <p className="poster-kicker">Review</p>
        <h1>저장 전 확인</h1>
        <p>AI 초안은 확정 전까지 추천 근거로 쓰지 않습니다.</p>
      </div>

      <div className="closet-review-list">
        {visibleDrafts.map((draft) => (
          <article className="closet-review-card" key={draft.id}>
            <img alt={`${draft.name ?? "옷"} 후보`} src={draft.photo_data_url} />
            <div>
              <p className="poster-kicker">
                {draft.analysis_status === "confirmed" ? "확인됨" : "확인 필요"}
              </p>
              <h2>{draft.name || "이름 확인 필요"}</h2>
              <p>{[draft.color, draft.detected_type, draft.season].filter(Boolean).join(" · ")}</p>
              <p>사이즈: {draft.size_source === "unknown" ? "확인 필요" : draft.size}</p>
              {editingId === draft.id ? (
                <div className="grid gap-2">
                  <label className="grid gap-1 text-xs font-black">
                    이름
                    <input
                      aria-label="이름"
                      className="ui-input"
                      onChange={(event) => setEditName(event.target.value)}
                      value={editName}
                    />
                  </label>
                  <button className="ui-button-accent h-11" onClick={saveEdit} type="button">
                    수정 저장
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    aria-label={`${draft.name} 수정`}
                    className="ui-button-secondary h-11 flex-1"
                    onClick={() => startEdit(draft)}
                    type="button"
                  >
                    수정
                  </button>
                  <button
                    aria-label={`${draft.name} 삭제`}
                    className="ui-button-secondary h-11 flex-1"
                    onClick={() => removeDraft(draft.id)}
                    type="button"
                  >
                    삭제
                  </button>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>

      <button className="ui-button-accent h-14 w-full" onClick={saveToCloset} type="button">
        옷장에 저장
      </button>
    </section>
  );
}
```

- [ ] **Step 5: Add review styles**

Append to `app/globals.css`:

```css
  .closet-review-screen {
    @apply space-y-6 pb-28;
  }

  .closet-review-list {
    @apply grid gap-4;
  }

  .closet-review-card {
    @apply grid grid-cols-[96px_1fr] gap-4 rounded-[1.75rem] p-4;
    background: var(--color-surface-raised);
  }

  .closet-review-card img {
    @apply aspect-[3/4] w-full rounded-2xl object-cover;
  }

  .closet-review-card h2 {
    @apply mt-2 text-xl font-black leading-6 tracking-[-0.04em] text-ink;
  }

  .closet-review-card p {
    @apply text-sm font-bold leading-5 text-muted;
  }
```

- [ ] **Step 6: Run checks**

Run:

```bash
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/closet/review/page.tsx components/closet/ClosetDraftReviewClient.tsx app/globals.css tests/e2e/onboarding.spec.ts
git commit -m "feat: add closet draft review"
```

---

## Task 5: Closet Entry Integration

**Files:**
- Modify: `components/closet/ClosetInventoryEditor.tsx`
- Modify: `app/closet/page.tsx`
- Modify: `app/globals.css`
- Test: `tests/e2e/onboarding.spec.ts`

- [ ] **Step 1: Add E2E expectation for mode chooser**

Add to the closet E2E path:

```ts
await page.goto("/closet");
await page.getByLabel("옷 추가").click();
await expect(page.getByText("빠른 촬영")).toBeVisible();
await expect(page.getByText("한 벌 직접 등록")).toBeVisible();
```

- [ ] **Step 2: Run E2E and verify failure**

Run:

```bash
npm run test:e2e -- tests/e2e/onboarding.spec.ts
```

Expected: FAIL because the mode chooser does not exist.

- [ ] **Step 3: Add mode chooser to closet editor**

Modify `components/closet/ClosetInventoryEditor.tsx`:

```tsx
const [isModeChoosing, setIsModeChoosing] = useState(false);

function openAddChooser() {
  setIsModeChoosing(true);
}

function openSingleAddModal() {
  setIsModeChoosing(false);
  openAddModal();
}
```

Change the `+` button:

```tsx
<button
  aria-label="옷 추가"
  className="closet-add-button"
  onClick={openAddChooser}
  type="button"
>
  +
</button>
```

Render the chooser:

```tsx
{isModeChoosing ? (
  <div className="closet-mode-sheet" role="dialog" aria-label="옷 추가 방식">
    <button
      className="closet-mode-primary"
      onClick={() => {
        window.location.href = "/closet/batch";
      }}
      type="button"
    >
      <span>빠른 촬영</span>
      <small>여러 벌을 한 번에 추가</small>
    </button>
    <button className="closet-mode-secondary" onClick={openSingleAddModal} type="button">
      <span>한 벌 직접 등록</span>
      <small>사진 1장과 메모를 직접 입력</small>
    </button>
    <button
      className="text-sm font-black text-muted underline underline-offset-4"
      onClick={() => setIsModeChoosing(false)}
      type="button"
    >
      닫기
    </button>
  </div>
) : null}
```

- [ ] **Step 4: Add chooser styles**

Append to `app/globals.css`:

```css
  .closet-mode-sheet {
    @apply fixed inset-x-5 bottom-[calc(var(--bottom-tab-height)+1rem)] z-40 grid gap-3 rounded-[2rem] p-4;
    background: rgba(248, 249, 250, 0.96);
    box-shadow: 0 24px 60px rgba(5, 17, 37, 0.22);
  }

  .closet-mode-primary,
  .closet-mode-secondary {
    @apply grid gap-1 rounded-2xl p-4 text-left;
  }

  .closet-mode-primary {
    background: var(--color-ink);
    color: var(--color-accent-ink);
  }

  .closet-mode-secondary {
    background: var(--color-surface-raised);
    color: var(--color-ink);
  }

  .closet-mode-primary span,
  .closet-mode-secondary span {
    @apply text-base font-black;
  }

  .closet-mode-primary small,
  .closet-mode-secondary small {
    @apply text-xs font-bold opacity-70;
  }
```

- [ ] **Step 5: Run checks**

Run:

```bash
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/closet/ClosetInventoryEditor.tsx app/globals.css tests/e2e/onboarding.spec.ts
git commit -m "feat: connect closet batch entry"
```

---

## Task 6: Visual Smoke, Harness Docs, And Full Verification

**Files:**
- Modify: `scripts/visual-app-smoke.mjs`
- Modify: `AGENTS.md`
- Modify: `docs/product/mvp-critical-path.md`
- Modify: `docs/engineering/verification-matrix.md`

- [ ] **Step 1: Add visual smoke pages**

Modify `scripts/visual-app-smoke.mjs` pages list:

```js
{
  id: "closet-batch",
  path: "/closet/batch",
  visibleText: "빠른 옷장 등록",
  expectedTexts: ["여러 장을 한 번에 추가하세요", "체크 3회"]
},
{
  id: "closet-review",
  path: "/closet/review",
  visibleText: "저장 전 확인",
  expectedTexts: ["AI 초안은 확정 전까지", "체크 3회"],
  seedState: {
    closet_item_drafts: [
      {
        id: "visual-draft-top",
        photo_data_url: tinyPng,
        analysis_status: "confirmed",
        category: "tops",
        name: "네이비 셔츠",
        color: "네이비",
        detected_type: "셔츠",
        analysis_confidence: 0.82,
        size_source: "unknown",
        size_confidence: 0
      }
    ]
  }
}
```

- [ ] **Step 2: Add harness rules**

Modify `AGENTS.md` 검증 보고 규칙:

```md
- `CLOSET_ANALYSIS_PROVIDER=mock` 기반 통과를 실제 옷 인식 성공으로 보고하지 않는다.
- 옷장 대량 등록의 AI 추정값은 사용자가 확인하기 전까지 추천 핵심 근거로 쓰지 않는다.
- 옷장 대량 등록을 수정하면 3장 업로드, 1장 수정, 1장 삭제, 1장 저장 E2E와 `/closet/batch`, `/closet/review` visual smoke를 확인해야 한다.
```

- [ ] **Step 3: Update product critical path**

Modify `docs/product/mvp-critical-path.md` Must Work section:

```md
- 옷장 등록은 한 벌 직접 등록과 빠른 대량 촬영 등록을 모두 제공해야 한다.
- 대량 촬영 draft는 사용자 확인 전까지 `closet_items`로 승격하지 않는다.
- 사이즈는 사진 1장만으로 확정하지 않고 `size_source`로 출처를 구분한다.
```

- [ ] **Step 4: Update verification matrix**

In `docs/engineering/verification-matrix.md`, add:

```md
| Closet batch capture | Unit + integration + E2E + visual | `npm run test:unit -- tests/unit/closet-batch.test.ts`, `npm run test:integration -- tests/integration/closet-analyze-route.test.ts`, `npm run test:e2e`, `npm run visual:app` | mock provider only unless `CLOSET_ANALYSIS_PROVIDER=gemini` smoke exists |
```

- [ ] **Step 5: Run full verification sequentially**

Run commands sequentially, not in parallel:

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run test:integration
npm run test:e2e
npm run visual:app
npm run build
npm run check:gc
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 6: Inspect visual artifacts**

Open these files and confirm the UI is not old-system residue:

```text
output/playwright/app-visual-smoke/mobile-closet-batch.png
output/playwright/app-visual-smoke/mobile-closet-review.png
output/playwright/app-visual-smoke/desktop-closet-batch.png
output/playwright/app-visual-smoke/desktop-closet-review.png
```

Expected:

- batch screen shows the dark slate hero and large multi-photo dropzone.
- review screen shows draft cards with photo, short metadata, edit/delete actions, and save CTA.
- credit badge and bottom tab are visible.

- [ ] **Step 7: Commit**

```bash
git add AGENTS.md docs/product/mvp-critical-path.md docs/engineering/verification-matrix.md scripts/visual-app-smoke.mjs
git commit -m "test: verify closet batch capture flow"
```

---

## Self-Review

- Spec coverage: draft model, API contract, batch screen, review screen, error handling, size strategy, harness rules, and verification are all mapped to tasks.
- Scope: Gemini real Vision provider, label OCR, real measurement estimation, product search, and automatic size confirmation remain outside this plan.
- Type consistency: `ClosetItemDraft`, `ClosetAnalysisStatus`, `size_source`, `analysis_confidence`, and `closet_item_drafts` names are consistent across tasks.
- Verification: plan includes unit, integration, E2E, visual smoke, build, GC, and diff whitespace checks.
