"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchAuthSession } from "@/lib/auth/client";
import {
  readCurrentUserProfile,
  updateCurrentUserProfile
} from "@/lib/firebase/firestore";

export default function SettingsPage() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [preferredProgram, setPreferredProgram] = useState("style");
  const [email, setEmail] = useState<string | null>(null);
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

      const profile = await readCurrentUserProfile(user.uid).catch(() => null);

      if (!profile || !active) {
        setDisplayName(user.name ?? "");
        setIsLoading(false);
        return;
      }

      setDisplayName(profile.displayName ?? user.name ?? "");
      setBio(profile.bio ?? "");
      setPreferredProgram(profile.preferredProgram ?? "style");
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

    try {
      await updateCurrentUserProfile(uid, {
        displayName,
        bio,
        preferredProgram
      });
      setSaved(true);
    } catch {
      setErrorMessage("정보 저장에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="app-shell flex min-h-screen flex-col justify-between">
      <div className="poster-grid pt-6">
        <div className="flex items-center justify-between border-b-2 border-black pb-4">
          <div className="flex items-center gap-4">
            <Link className="text-lg" href="/profile">
              ←
            </Link>
            <p className="text-sm font-black tracking-tight text-ink">RE:MAN</p>
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
        <section className="border-2 border-black bg-[#fcf8ef]">
          <div className="border-b-2 border-black p-5">
            <p className="poster-kicker">Account</p>
            <p className="mt-2 text-lg font-black text-ink">
              {isLoading ? "불러오는 중" : email ?? "이메일 정보 없음"}
            </p>
          </div>
          <div className="space-y-5 p-5">
          <label className="space-y-2">
            <span className="poster-kicker">Display Name</span>
            <input
              className="h-12 w-full border-2 border-black bg-white px-4 text-base font-semibold text-ink outline-none"
              disabled={isLoading}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="표시 이름"
              value={displayName}
            />
          </label>
          <label className="space-y-2">
            <span className="poster-kicker">Bio</span>
            <textarea
              className="min-h-32 w-full border-2 border-black bg-white p-4 text-sm font-medium text-ink outline-none"
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
              className="h-12 w-full border-2 border-black bg-white px-4 text-base font-semibold text-ink outline-none"
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
      </div>
      <div className="pb-10">
        <button
          className="flex h-14 w-full items-center justify-center border-2 border-black bg-accent text-base font-black text-black disabled:opacity-40"
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
