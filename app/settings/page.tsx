"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchAuthSession } from "@/lib/auth/client";
import {
  readCurrentUserProfile,
  updateCurrentUserProfile
} from "@/lib/firebase/firestore";
import { patchOnboardingState, readOnboardingState } from "@/lib/onboarding/storage";

export default function SettingsPage() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [preferredProgram, setPreferredProgram] = useState("style");
  const [email, setEmail] = useState<string | null>(null);
  const [styleGoal, setStyleGoal] = useState("");
  const [confidenceLevel, setConfidenceLevel] = useState("");
  const [closetTops, setClosetTops] = useState("");
  const [closetBottoms, setClosetBottoms] = useState("");
  const [closetShoes, setClosetShoes] = useState("");
  const [closetOuterwear, setClosetOuterwear] = useState("");
  const [closetAvoid, setClosetAvoid] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      setClosetTops(localState.closet_profile?.tops ?? "");
      setClosetBottoms(localState.closet_profile?.bottoms ?? "");
      setClosetShoes(localState.closet_profile?.shoes ?? "");
      setClosetOuterwear(localState.closet_profile?.outerwear ?? "");
      setClosetAvoid(localState.closet_profile?.avoid ?? "");

      const profile = await readCurrentUserProfile(user.uid).catch(() => null);

      if (!profile || !active) {
        setDisplayName(user.name ?? "");
        setIsLoading(false);
        return;
      }

      setDisplayName(profile.displayName ?? user.name ?? "");
      setBio(profile.bio ?? "");
      setPreferredProgram(profile.preferredProgram ?? "style");
      setStyleGoal(profile.survey?.style_goal ?? localState.survey.style_goal ?? "");
      setConfidenceLevel(
        profile.survey?.confidence_level ?? localState.survey.confidence_level ?? ""
      );
      setClosetTops(profile.closet_profile?.tops ?? localState.closet_profile?.tops ?? "");
      setClosetBottoms(
        profile.closet_profile?.bottoms ?? localState.closet_profile?.bottoms ?? ""
      );
      setClosetShoes(profile.closet_profile?.shoes ?? localState.closet_profile?.shoes ?? "");
      setClosetOuterwear(
        profile.closet_profile?.outerwear ?? localState.closet_profile?.outerwear ?? ""
      );
      setClosetAvoid(profile.closet_profile?.avoid ?? localState.closet_profile?.avoid ?? "");
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
    const closetProfile = {
      tops: closetTops,
      bottoms: closetBottoms,
      shoes: closetShoes,
      outerwear: closetOuterwear,
      avoid: closetAvoid
    };

    patchOnboardingState({
      user_id: uid,
      email: email ?? undefined,
      survey,
      closet_profile: closetProfile
    });

    try {
      await updateCurrentUserProfile(uid, {
        displayName,
        bio,
        preferredProgram,
        survey,
        closet_profile: closetProfile
      });
      setSaved(true);
    } catch {
      setSaved(true);
      setErrorMessage("로컬에는 저장됐지만 계정 동기화는 실패했습니다. 다시 로그인 후 저장해 주세요.");
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
          <Link
            className="text-sm font-black uppercase tracking-[0.12em] text-ink underline underline-offset-4"
            href="/profile"
          >
            Profile
          </Link>
        </div>
        <div className="space-y-4 poster-rule">
          <p className="poster-kicker">Settings</p>
          <h1 className="text-[40px] font-black leading-[1.03] tracking-[-0.05em] text-ink">
            계정에 붙일 기본 정보를 정리합니다
          </h1>
          <p className="max-w-sm text-base font-semibold leading-7 text-muted">
            이 정보는 코칭 기록을 다시 불러오고, 다음 프로그램을 추천할 때 기준으로 씁니다.
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
                onChange={(event) => setDisplayName(event.target.value)}
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
                onChange={(event) => setBio(event.target.value)}
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
                onChange={(event) => setPreferredProgram(event.target.value)}
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
              여기서 바꾼 목표와 옷장 정보는 다음 사진 분석과 deep dive에 바로 반영됩니다.
            </p>
          </div>
          <label className="space-y-2">
            <span className="poster-kicker">Style Goal</span>
            <input
              className="ui-input w-full text-base"
              disabled={isLoading}
              onChange={(event) => setStyleGoal(event.target.value)}
              placeholder="예: 소개팅 전에 단정한 인상 만들기"
              value={styleGoal}
            />
          </label>
          <label className="space-y-2">
            <span className="poster-kicker">Confidence</span>
            <select
              className="ui-input w-full text-base"
              disabled={isLoading}
              onChange={(event) => setConfidenceLevel(event.target.value)}
              value={confidenceLevel}
            >
              <option value="">선택 안 함</option>
              <option value="처음이라 어려움">처음이라 어려움</option>
              <option value="배우는 중">배우는 중</option>
              <option value="조금 자신 있음">조금 자신 있음</option>
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="poster-kicker">Tops</span>
              <input
                className="ui-input w-full text-base"
                disabled={isLoading}
                onChange={(event) => setClosetTops(event.target.value)}
                placeholder="무지 티셔츠, 셔츠"
                value={closetTops}
              />
            </label>
            <label className="space-y-2">
              <span className="poster-kicker">Bottoms</span>
              <input
                className="ui-input w-full text-base"
                disabled={isLoading}
                onChange={(event) => setClosetBottoms(event.target.value)}
                placeholder="청바지, 검정 슬랙스"
                value={closetBottoms}
              />
            </label>
            <label className="space-y-2">
              <span className="poster-kicker">Shoes</span>
              <input
                className="ui-input w-full text-base"
                disabled={isLoading}
                onChange={(event) => setClosetShoes(event.target.value)}
                placeholder="흰색 스니커즈"
                value={closetShoes}
              />
            </label>
            <label className="space-y-2">
              <span className="poster-kicker">Outerwear</span>
              <input
                className="ui-input w-full text-base"
                disabled={isLoading}
                onChange={(event) => setClosetOuterwear(event.target.value)}
                placeholder="셔츠, 가디건, 자켓"
                value={closetOuterwear}
              />
            </label>
          </div>
          <label className="space-y-2">
            <span className="poster-kicker">Avoid</span>
            <input
              className="ui-input w-full text-base"
              disabled={isLoading}
              onChange={(event) => setClosetAvoid(event.target.value)}
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
