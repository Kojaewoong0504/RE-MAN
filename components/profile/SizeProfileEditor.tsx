"use client";

import type { SizeProfile } from "@/lib/onboarding/storage";

const fitOptions = [
  "선택 안 함",
  "너무 붙지 않는 레귤러 실루엣",
  "깔끔한 슬림 실루엣",
  "편한 세미오버 실루엣"
];

export function SizeProfileEditor({
  disabled = false,
  profile,
  onChange
}: {
  disabled?: boolean;
  profile: SizeProfile;
  onChange: (profile: SizeProfile) => void;
}) {
  function updateProfile(key: keyof SizeProfile, value: string) {
    onChange({
      ...profile,
      [key]: value
    });
  }

  return (
    <section className="space-y-5 scroll-mt-24 border-t border-black/15 pt-6" id="size-profile">
      <div className="space-y-2">
        <p className="poster-kicker">Size Profile</p>
        <h2 className="text-[28px] font-black leading-[1.05] tracking-[-0.05em] text-ink">
          평소 사이즈를 기준으로 남깁니다
        </h2>
        <p className="text-[15px] font-medium leading-6 text-muted">
          사진에서 치수를 추정하지 않습니다. 알고 있는 평소 사이즈만 넣으면 결과 화면에서
          먼저 확인할 사이즈 후보를 좁혀줍니다.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-black text-ink">키</span>
          <input
            className="ui-input w-full"
            disabled={disabled}
            inputMode="numeric"
            onChange={(event) => updateProfile("height_cm", event.target.value)}
            placeholder="예: 175"
            value={profile.height_cm ?? ""}
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-black text-ink">몸무게</span>
          <input
            className="ui-input w-full"
            disabled={disabled}
            inputMode="numeric"
            onChange={(event) => updateProfile("weight_kg", event.target.value)}
            placeholder="예: 72"
            value={profile.weight_kg ?? ""}
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-black text-ink">상의</span>
          <input
            className="ui-input w-full"
            disabled={disabled}
            onChange={(event) => updateProfile("top_size", event.target.value)}
            placeholder="M, L, XL"
            value={profile.top_size ?? ""}
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-black text-ink">하의</span>
          <input
            className="ui-input w-full"
            disabled={disabled}
            onChange={(event) => updateProfile("bottom_size", event.target.value)}
            placeholder="30, 32, 34"
            value={profile.bottom_size ?? ""}
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-black text-ink">신발</span>
          <input
            className="ui-input w-full"
            disabled={disabled}
            inputMode="numeric"
            onChange={(event) => updateProfile("shoe_size_mm", event.target.value)}
            placeholder="260, 270, 280"
            value={profile.shoe_size_mm ?? ""}
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-black text-ink">선호하는 실루엣</span>
          <select
            className="ui-input w-full"
            disabled={disabled}
            onChange={(event) =>
              updateProfile("fit_preference", event.target.value === "선택 안 함" ? "" : event.target.value)
            }
            value={profile.fit_preference ?? "선택 안 함"}
          >
            {fitOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
