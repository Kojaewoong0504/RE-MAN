"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClosetInventoryEditor } from "@/components/closet/ClosetInventoryEditor";
import { CreditStatus } from "@/components/credits/CreditStatus";
import { fetchAuthSession } from "@/lib/auth/client";
import { fetchClosetPreviewUrls, type ClosetPreviewMap } from "@/lib/closet/preview-client";
import {
  readCurrentUserProfile,
  syncClosetItemsToServer,
  updateCurrentUserProfile
} from "@/lib/firebase/firestore";
import {
  buildClosetItemsFromProfile,
  buildClosetProfileFromItems,
  getClosetCategoryLabel,
  getMinimumClosetReadiness,
  normalizeClosetItems,
  readOnboardingState,
  saveClosetContextToOnboardingState,
  type ClosetItem
} from "@/lib/onboarding/storage";
import type { ClosetProfile } from "@/lib/agents/contracts";
import type { AuthUser } from "@/lib/auth/types";
import type { UserProfileDocument } from "@/lib/firebase/firestore";

function toClosetProfile(input: Partial<ClosetProfile> | null | undefined): ClosetProfile | undefined {
  if (!input) {
    return undefined;
  }

  return {
    tops: input.tops ?? "",
    bottoms: input.bottoms ?? "",
    shoes: input.shoes ?? "",
    outerwear: input.outerwear ?? "",
    avoid: input.avoid ?? ""
  };
}

function getCategoryCount(items: ClosetItem[], category: ClosetItem["category"]) {
  return items.filter((item) => item.category === category).length;
}

function getInitialClosetItems(localItems: ClosetItem[], profile: UserProfileDocument | null) {
  const profileItems = normalizeClosetItems(profile?.closet_items);

  if (profileItems.length > 0) {
    return profileItems;
  }

  if (localItems.length > 0) {
    return localItems;
  }

  return buildClosetItemsFromProfile(toClosetProfile(profile?.closet_profile));
}

function mergePreviewUrlsIntoItems(items: ClosetItem[], previewUrls: ClosetPreviewMap) {
  return items.map((item) => {
    const previewUrl = previewUrls[item.id];

    if (!previewUrl || item.photo_data_url) {
      return item;
    }

    return {
      ...item,
      image_url: previewUrl
    };
  });
}

function getPersistableClosetItems(items: ClosetItem[]) {
  return items.map((item) => {
    if (!item.storage_bucket || !item.storage_path || item.photo_data_url) {
      return item;
    }

    return {
      ...item,
      image_url: ""
    };
  });
}

export default function ClosetPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfileDocument | null>(null);
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [avoid, setAvoid] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [reviewSavedCount, setReviewSavedCount] = useState(0);
  const [previewUrls, setPreviewUrls] = useState<ClosetPreviewMap>({});
  const hasUserEditedRef = useRef(false);

  async function syncPreviewUrls(nextItems: ClosetItem[]) {
    try {
      const nextPreviewUrls = await fetchClosetPreviewUrls(nextItems);
      setPreviewUrls(nextPreviewUrls);
      setItems((currentItems) => mergePreviewUrlsIntoItems(currentItems, nextPreviewUrls));
    } catch {
      // Keep the last successful preview map. A later failed refresh should not
      // erase previews that are already being shown.
    }
  }

  useEffect(() => {
    let active = true;

    async function load() {
      const searchParams = new URLSearchParams(window.location.search);
      const isFromReview = searchParams.get("from") === "review";
      const savedCount = Number(searchParams.get("saved") ?? "0");
      setReviewSavedCount(isFromReview && Number.isFinite(savedCount) ? Math.max(0, savedCount) : 0);
      setIsLoading(true);
      const sessionUser = await fetchAuthSession();

      if (!sessionUser) {
        router.replace("/login?returnTo=/closet");
        return;
      }

      if (!active) {
        return;
      }

      setUser(sessionUser);
      const localState = readOnboardingState();
      const localItems = normalizeClosetItems(localState.closet_items);
      const localProfileItems =
        localItems.length > 0
          ? localItems
          : buildClosetItemsFromProfile(localState.closet_profile);

      // Local closet context is the immediate product input. Remote profile sync
      // should enrich it later, not make the closet look empty while loading.
      setItems(localProfileItems);
      void syncPreviewUrls(localProfileItems);
      setAvoid(localState.closet_profile?.avoid ?? "");
      setIsLoading(false);

      const nextProfile = await readCurrentUserProfile(sessionUser.uid).catch(() => null);

      if (!active) {
        return;
      }

      setProfile(nextProfile);
      if (!hasUserEditedRef.current) {
        setItems(getInitialClosetItems(localItems, nextProfile));
        void syncPreviewUrls(getInitialClosetItems(localItems, nextProfile));
        setAvoid(nextProfile?.closet_profile?.avoid ?? localState.closet_profile?.avoid ?? "");
      }
      setIsLoading(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, [router]);

  async function handleSave() {
    if (!user) {
      return;
    }

    setIsSaving(true);
    setStatus("idle");
    const persistableItems = getPersistableClosetItems(items);

    const nextState = saveClosetContextToOnboardingState({
      user_id: user.uid,
      email: user.email ?? undefined,
      items: persistableItems,
      avoid
    });
    const closetProfile = nextState.closet_profile ?? buildClosetProfileFromItems(items, avoid);

    try {
      const persisted = await syncClosetItemsToServer({
        items: persistableItems,
        closet_profile: closetProfile,
        size_profile: profile?.size_profile ?? nextState.size_profile
      });

      if (persisted.closet_items.length) {
        setItems(persisted.closet_items);
        void syncPreviewUrls(persisted.closet_items);
        saveClosetContextToOnboardingState({
          user_id: user.uid,
          email: user.email ?? undefined,
          items: persisted.closet_items,
          avoid: persisted.closet_profile?.avoid ?? closetProfile.avoid,
          size_profile: profile?.size_profile ?? nextState.size_profile
        });
      }

      await updateCurrentUserProfile(user.uid, {
        displayName: profile?.displayName ?? user.name ?? "",
        bio: profile?.bio ?? "",
        preferredProgram: profile?.preferredProgram ?? "style",
        survey: profile?.survey ?? nextState.survey,
        closet_items: persisted.closet_items.length ? persisted.closet_items : persistableItems,
        closet_profile: persisted.closet_profile ?? closetProfile,
        size_profile: profile?.size_profile ?? nextState.size_profile
      });
      setStatus("saved");
    } catch {
      setStatus("error");
    } finally {
      setIsSaving(false);
    }
  }

  function handleStartStyleCheck() {
    void handleSave().finally(() => {
      router.push("/programs/style/onboarding/upload");
    });
  }

  const totalCount = items.length;
  const closetReadiness = getMinimumClosetReadiness(items);
  const missingClosetLabels = closetReadiness.missingCategories.map(getClosetCategoryLabel);

  return (
    <main className="app-shell flex min-h-screen flex-col justify-between">
      <div className="poster-grid pt-6">
        <div className="app-header">
          <div className="flex items-center gap-4">
            <Link className="app-back-button" href="/profile">
              ←
            </Link>
            <p className="app-brand">RE:MAN</p>
          </div>
          <div className="app-header-actions">
            <CreditStatus variant="badge" />
          </div>
        </div>

        <section className="closet-slate-hero">
          <p className="poster-kicker">Closet</p>
          <h1>
            옷장 사진 저장
          </h1>
          <p>
            자주 입는 옷을 사진으로 남기면 추천이 내 옷장 기준으로 좁혀집니다.
          </p>
        </section>

        <section className="closet-metric-strip">
          <div>
            <p className="poster-kicker">All</p>
            <p>{totalCount}</p>
          </div>
          <div>
            <p className="poster-kicker">Top</p>
            <p>
              {getCategoryCount(items, "tops")}
            </p>
          </div>
          <div>
            <p className="poster-kicker">Bottom</p>
            <p>
              {getCategoryCount(items, "bottoms")}
            </p>
          </div>
          <div>
            <p className="poster-kicker">Shoes</p>
            <p>
              {getCategoryCount(items, "shoes")}
            </p>
          </div>
        </section>

        <section className="closet-readiness-panel">
          <div>
            <p className="poster-kicker">Ready Check</p>
            <h2>{closetReadiness.isReady ? "추천 준비 완료" : "더 필요한 옷장"}</h2>
          </div>
          <p>
            {closetReadiness.isReady
              ? "상의, 하의, 신발이 준비됐습니다."
              : `${missingClosetLabels.join(", ")}을 추가하면 분석할 수 있습니다.`}
          </p>
          <div className="closet-readiness" aria-label="추천에 필요한 옷장">
            {closetReadiness.requiredCategories.map((category) => {
              const ready = closetReadiness.presentCategories.includes(category);

              return (
                <span className={ready ? "closet-readiness-ready" : ""} key={category}>
                  {getClosetCategoryLabel(category)} {ready ? "✓" : "필요"}
                </span>
              );
            })}
          </div>
        </section>

        {reviewSavedCount > 0 ? (
          <section aria-label="옷장 저장 결과" className="closet-review-result">
            <p className="poster-kicker">Saved</p>
            <h2>{reviewSavedCount}벌 저장됨</h2>
            <p>
              {closetReadiness.isReady
                ? "스타일 체크 준비 완료"
                : `${missingClosetLabels.join(", ")}만 추가하면 분석 가능`}
            </p>
          </section>
        ) : null}

        <section className="ui-panel-muted space-y-5">
          {isLoading ? (
            <div className="ui-panel">
              <p className="text-sm font-bold leading-6 text-muted">
                옷장을 불러오는 중.
              </p>
            </div>
          ) : (
            <>
              <ClosetInventoryEditor
                items={items}
                previewUrls={previewUrls}
                onChange={(nextItems) => {
                  hasUserEditedRef.current = true;
                  setItems(nextItems);
                  void syncPreviewUrls(nextItems);
                }}
              />
            </>
          )}
          {status === "saved" ? (
            <p className="text-sm font-black text-ink">옷장이 저장되었습니다.</p>
          ) : null}
          {status === "error" ? (
            <p className="text-sm font-bold leading-6 text-red-700">
              계정 저장 실패.
            </p>
          ) : null}
        </section>
      </div>

      <div className="grid gap-3 pb-10">
        <button
          className="ui-button-accent h-14 w-full text-base"
          disabled={isLoading || isSaving || !user}
          onClick={() => void handleSave()}
          type="button"
        >
          {isLoading ? "옷장 불러오는 중..." : isSaving ? "저장 중..." : "옷장 저장"}
        </button>
        <button
          className="ui-button-secondary h-14 w-full text-base"
          disabled={isLoading || isSaving || !user || !closetReadiness.isReady}
          onClick={handleStartStyleCheck}
          type="button"
        >
          이 옷장으로 스타일 체크
        </button>
      </div>
    </main>
  );
}
