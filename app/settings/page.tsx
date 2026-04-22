"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CreditStatus } from "@/components/credits/CreditStatus";
import { SizeProfileEditor } from "@/components/profile/SizeProfileEditor";
import { fetchAuthSession } from "@/lib/auth/client";
import {
  readCurrentUserProfile,
  syncClosetItemsToServer,
  updateCurrentUserProfile
} from "@/lib/firebase/firestore";
import {
  buildClosetItemsFromProfile,
  buildClosetProfileFromItems,
  hasSizeProfileSignal,
  normalizeClosetItems,
  normalizeSizeProfile,
  patchOnboardingState,
  readOnboardingState,
  saveClosetContextToOnboardingState,
  type ClosetItem,
  type SizeProfile
} from "@/lib/onboarding/storage";
import type { ClosetProfile } from "@/lib/agents/contracts";

function toClosetProfile(input: Partial<ClosetProfile> | null | undefined): ClosetProfile | undefined {
  if (!input) {
    return undefined;
  }

  return {
    tops: input.tops ?? "",
    bottoms: input.bottoms ?? "",
    shoes: input.shoes ?? "",
    outerwear: input.outerwear ?? "",
    hats: input.hats ?? "",
    bags: input.bags ?? "",
    avoid: input.avoid ?? ""
  };
}

export default function SettingsPage() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [preferredProgram, setPreferredProgram] = useState("style");
  const [email, setEmail] = useState<string | null>(null);
  const [styleGoal, setStyleGoal] = useState("");
  const [confidenceLevel, setConfidenceLevel] = useState("");
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  const [closetAvoid, setClosetAvoid] = useState("");
  const [sizeProfile, setSizeProfile] = useState<SizeProfile>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasUserEditedRef = useRef(false);

  function markEdited() {
    hasUserEditedRef.current = true;
    setSaved(false);
  }

  useEffect(() => {
    let active = true;

    async function load() {
      setIsLoading(true);
      setErrorMessage(null);

      const user = await fetchAuthSession();

      if (!user) {
        router.replace("/login?returnTo=/settings");
        return;
      }

      if (!active) {
        return;
      }

      setUid(user.uid);
      setEmail(user.email);

      const localState = readOnboardingState();
      setStyleGoal(localState.survey.style_goal ?? "");
      setConfidenceLevel(localState.survey.confidence_level ?? "");
      setClosetItems(
        normalizeClosetItems(localState.closet_items).length
          ? normalizeClosetItems(localState.closet_items)
          : buildClosetItemsFromProfile(localState.closet_profile)
      );
      setClosetAvoid(localState.closet_profile?.avoid ?? "");
      setSizeProfile(normalizeSizeProfile(localState.size_profile));

      const profile = await readCurrentUserProfile(user.uid).catch(() => null);

      if (!profile || !active) {
        setDisplayName(user.name ?? "");
        setIsLoading(false);
        return;
      }

      if (!hasUserEditedRef.current) {
        setDisplayName(profile.displayName ?? user.name ?? "");
        setBio(profile.bio ?? "");
        setPreferredProgram(profile.preferredProgram ?? "style");
        setStyleGoal(profile.survey?.style_goal ?? localState.survey.style_goal ?? "");
        setConfidenceLevel(
          profile.survey?.confidence_level ?? localState.survey.confidence_level ?? ""
        );
        setClosetItems(
          normalizeClosetItems(profile.closet_items).length
            ? normalizeClosetItems(profile.closet_items)
            : normalizeClosetItems(localState.closet_items).length
              ? normalizeClosetItems(localState.closet_items)
              : buildClosetItemsFromProfile(
                  toClosetProfile(profile.closet_profile) ?? localState.closet_profile
                )
        );
        setClosetAvoid(profile.closet_profile?.avoid ?? localState.closet_profile?.avoid ?? "");
        const profileSize = normalizeSizeProfile(profile.size_profile);
        setSizeProfile(
          hasSizeProfileSignal(profileSize)
            ? profileSize
            : normalizeSizeProfile(localState.size_profile)
        );
      }
      setIsLoading(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, [router]);

  async function handleSave() {
    if (!uid) {
      return;
    }

    setIsSaving(true);
    setSaved(false);
    setErrorMessage(null);

    const currentState = readOnboardingState();
    const survey = {
      ...currentState.survey,
      style_goal: styleGoal,
      confidence_level: confidenceLevel
    };
    const closetProfile = buildClosetProfileFromItems(closetItems, closetAvoid);

    saveClosetContextToOnboardingState({
      user_id: uid,
      email: email ?? undefined,
      items: closetItems,
      avoid: closetProfile.avoid,
      size_profile: sizeProfile
    });
    patchOnboardingState({ survey });
    window.sessionStorage.setItem(
      "reman:style-settings",
      JSON.stringify({
        style_goal: survey.style_goal,
        confidence_level: survey.confidence_level,
        avoid: closetProfile.avoid
      })
    );

    try {
      const persisted = await syncClosetItemsToServer({
        items: closetItems,
        closet_profile: closetProfile,
        size_profile: sizeProfile
      });
      await updateCurrentUserProfile(uid, {
        displayName,
        bio,
        preferredProgram,
        survey,
        closet_profile: persisted.closet_profile ?? closetProfile,
        closet_items: persisted.closet_items.length ? persisted.closet_items : closetItems,
        size_profile: sizeProfile
      });
      setSaved(true);
    } catch {
      setSaved(true);
      setErrorMessage("계정 동기화 실패.");
    } finally {
      setIsSaving(false);
    }
  }

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
        <div className="space-y-4 poster-rule">
          <p className="poster-kicker">Settings</p>
          <h1 className="text-[40px] font-black leading-[1.03] tracking-[-0.05em] text-ink">
            설정
          </h1>
          <p className="max-w-sm text-base font-semibold leading-7 text-muted">
            계정과 코칭 기준.
          </p>
        </div>
        <section className="ui-panel p-0">
          <div className="border-b border-black/15 p-5">
            <p className="poster-kicker">Account</p>
            <p className="mt-2 text-lg font-black text-ink">
              {isLoading ? "불러오는 중" : email ?? "이메일 정보 없음"}
            </p>
          </div>
          <div className="space-y-5 p-5">
            <label className="space-y-2">
              <span className="poster-kicker">Display Name</span>
              <input
                className="ui-input w-full text-base"
                disabled={isLoading}
                onChange={(event) => {
                  markEdited();
                  setDisplayName(event.target.value);
                }}
                placeholder="표시 이름"
                value={displayName}
              />
            </label>
            <label className="space-y-2">
              <span className="poster-kicker">Bio</span>
              <textarea
                className="min-h-32 w-full border border-black/20 bg-white p-4 text-sm font-medium text-ink outline-none focus:border-black"
                disabled={isLoading}
                maxLength={160}
                onChange={(event) => {
                  markEdited();
                  setBio(event.target.value);
                }}
                placeholder="예: 소개팅 전에 인상을 정리하고 싶은 개발자"
                value={bio}
              />
              <span className="block text-right text-xs font-bold uppercase tracking-[0.14em] text-muted">
                {bio.length}/160
              </span>
            </label>
            <label className="space-y-2">
              <span className="poster-kicker">Preferred Program</span>
              <select
                className="ui-input w-full text-base"
                disabled={isLoading}
                onChange={(event) => {
                  markEdited();
                  setPreferredProgram(event.target.value);
                }}
                value={preferredProgram}
              >
                <option value="style">스타일</option>
                <option value="hair">헤어</option>
                <option value="body">체형/자세</option>
                <option value="skin">피부</option>
              </select>
            </label>
            {saved ? <p className="text-sm font-black text-ink">저장되었습니다.</p> : null}
            {errorMessage ? <p className="text-sm font-bold text-red-700">{errorMessage}</p> : null}
          </div>
        </section>
        <section className="ui-panel-muted space-y-5">
          <div className="space-y-2">
            <p className="poster-kicker">Style Profile</p>
            <h2 className="text-[30px] font-black leading-tight tracking-[-0.05em] text-ink">
              다음 체크에 쓸 기준
            </h2>
            <p className="text-sm font-bold leading-6 text-muted">
              다음 체크에 반영됩니다.
            </p>
          </div>
          <label className="space-y-2">
            <span className="poster-kicker">Style Goal</span>
            <input
              className="ui-input w-full text-base"
              disabled={isLoading}
              onChange={(event) => {
                markEdited();
                setStyleGoal(event.target.value);
              }}
              placeholder="예: 소개팅 전에 단정한 인상 만들기"
              value={styleGoal}
            />
          </label>
          <label className="space-y-2">
            <span className="poster-kicker">Confidence</span>
            <select
              className="ui-input w-full text-base"
              disabled={isLoading}
              onChange={(event) => {
                markEdited();
                setConfidenceLevel(event.target.value);
              }}
              value={confidenceLevel}
            >
              <option value="">선택 안 함</option>
              <option value="처음이라 어려움">처음이라 어려움</option>
              <option value="배우는 중">배우는 중</option>
              <option value="조금 자신 있음">조금 자신 있음</option>
            </select>
          </label>
          <section className="settings-closet-summary">
            <div>
              <p className="poster-kicker">Closet</p>
              <h3>옷장 {closetItems.length}개</h3>
              <span>사진 등록과 분류는 옷장 화면에서 관리합니다.</span>
            </div>
            <Link href="/closet">옷장 관리</Link>
          </section>
          <SizeProfileEditor
            disabled={isLoading}
            profile={sizeProfile}
            onChange={(nextProfile) => {
              markEdited();
              setSizeProfile(nextProfile);
            }}
          />
          <label className="space-y-2">
            <span className="poster-kicker">피하고 싶은 것</span>
            <input
              className="ui-input w-full text-base"
              disabled={isLoading}
              onChange={(event) => {
                markEdited();
                setClosetAvoid(event.target.value);
              }}
              placeholder="피하고 싶은 핏, 색, 아이템"
              value={closetAvoid}
            />
          </label>
        </section>
      </div>
      <div className="pb-10">
        <button
          className="ui-button-accent h-14 w-full text-base"
          disabled={isSaving || isLoading || !uid}
          onClick={() => void handleSave()}
          type="button"
        >
          {isLoading ? "정보 불러오는 중..." : isSaving ? "저장 중..." : "정보 저장"}
        </button>
      </div>
    </main>
  );
}
