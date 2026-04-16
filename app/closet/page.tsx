"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClosetInventoryEditor } from "@/components/closet/ClosetInventoryEditor";
import { fetchAuthSession } from "@/lib/auth/client";
import {
  readCurrentUserProfile,
  updateCurrentUserProfile
} from "@/lib/firebase/firestore";
import {
  buildClosetItemsFromProfile,
  buildClosetProfileFromItems,
  normalizeClosetItems,
  patchOnboardingState,
  readOnboardingState,
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

export default function ClosetPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfileDocument | null>(null);
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [avoid, setAvoid] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const hasUserEditedRef = useRef(false);

  useEffect(() => {
    let active = true;

    async function load() {
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
      setAvoid(localState.closet_profile?.avoid ?? "");
      setIsLoading(false);

      const nextProfile = await readCurrentUserProfile(sessionUser.uid).catch(() => null);

      if (!active) {
        return;
      }

      setProfile(nextProfile);
      if (!hasUserEditedRef.current) {
        setItems(getInitialClosetItems(localItems, nextProfile));
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

    const closetProfile = buildClosetProfileFromItems(items, avoid);
    const nextState = patchOnboardingState({
      user_id: user.uid,
      email: user.email ?? undefined,
      closet_items: items,
      closet_profile: closetProfile
    });

    try {
      await updateCurrentUserProfile(user.uid, {
        displayName: profile?.displayName ?? user.name ?? "",
        bio: profile?.bio ?? "",
        preferredProgram: profile?.preferredProgram ?? "style",
        survey: profile?.survey ?? nextState.survey,
        closet_items: items,
        closet_profile: closetProfile,
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
          <Link
            className="text-sm font-black uppercase tracking-[0.12em] text-ink underline underline-offset-4"
            href="/settings"
          >
            Settings
          </Link>
        </div>

        <section className="space-y-4 poster-rule">
          <p className="poster-kicker">Closet</p>
          <h1 className="text-[42px] font-black leading-[1.02] tracking-[-0.06em] text-ink">
            옷장 사진 저장
          </h1>
          <p className="max-w-sm text-base font-semibold leading-7 text-muted">
            가진 옷을 찍어두세요.
          </p>
        </section>

        <section className="grid grid-cols-4 border border-black/15 bg-surface text-center">
          <div className="border-r border-black/15 p-3">
            <p className="poster-kicker">All</p>
            <p className="mt-2 text-2xl font-black text-ink">{totalCount}</p>
          </div>
          <div className="border-r border-black/15 p-3">
            <p className="poster-kicker">Top</p>
            <p className="mt-2 text-2xl font-black text-ink">
              {getCategoryCount(items, "tops")}
            </p>
          </div>
          <div className="border-r border-black/15 p-3">
            <p className="poster-kicker">Bottom</p>
            <p className="mt-2 text-2xl font-black text-ink">
              {getCategoryCount(items, "bottoms")}
            </p>
          </div>
          <div className="p-3">
            <p className="poster-kicker">Shoes</p>
            <p className="mt-2 text-2xl font-black text-ink">
              {getCategoryCount(items, "shoes")}
            </p>
          </div>
        </section>

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
                onChange={(nextItems) => {
                  hasUserEditedRef.current = true;
                  setItems(nextItems);
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
          disabled={isLoading || isSaving || !user || totalCount === 0}
          onClick={handleStartStyleCheck}
          type="button"
        >
          이 옷장으로 스타일 체크
        </button>
      </div>
    </main>
  );
}
