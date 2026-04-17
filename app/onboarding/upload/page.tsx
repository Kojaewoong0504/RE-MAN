"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AccountAccessButton } from "@/components/common/AccountAccessButton";
import { BottomCTA } from "@/components/common/BottomCTA";
import { ClosetInventoryEditor } from "@/components/closet/ClosetInventoryEditor";
import { SizeProfileEditor } from "@/components/profile/SizeProfileEditor";
import { PhotoUploader } from "@/components/upload/PhotoUploader";
import type { ClosetProfile } from "@/lib/agents/contracts";
import { syncSurveyToFirestore } from "@/lib/firebase/firestore";
import {
  buildHistoryFromState,
  buildClosetItemsFromProfile,
  buildClosetProfileFromItems,
  getClosetCategoryLabel,
  getMinimumClosetReadiness,
  getRecentHistoryPreview,
  normalizeClosetItems,
  normalizeSizeProfile,
  patchOnboardingState,
  readOnboardingState,
  type ClosetItem,
  type SizeProfile
} from "@/lib/onboarding/storage";
import { isValidTextDescription, normalizeTextDescription } from "@/lib/upload/photo-input";

const emptyClosetProfile: ClosetProfile = {
  tops: "",
  bottoms: "",
  shoes: "",
  outerwear: "",
  avoid: ""
};

const styleGoals = ["전체적인 스타일 리셋", "비즈니스 캐주얼 업그레이드", "주말 룩 체크"];
const confidenceLevels = ["막막함", "괜찮음", "배우는 중", "준비됨"];
const defaultStyleGoal = "전체적인 스타일 리셋";
const defaultConfidenceLevel = "배우는 중";

function readSavedStyleSettings() {
  try {
    const raw = window.sessionStorage.getItem("reman:style-settings");

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<{
      style_goal: string;
      confidence_level: string;
      avoid: string;
    }>;

    return {
      style_goal: parsed.style_goal ?? "",
      confidence_level: parsed.confidence_level ?? "",
      avoid: parsed.avoid ?? ""
    };
  } catch {
    return null;
  }
}

export default function UploadPage() {
  const router = useRouter();
  const [image, setImage] = useState<string | undefined>();
  const [textDescription, setTextDescription] = useState<string | undefined>();
  const [closetProfile, setClosetProfile] = useState<ClosetProfile>(emptyClosetProfile);
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  const [sizeProfile, setSizeProfile] = useState<SizeProfile>({});
  const [styleGoal, setStyleGoal] = useState("");
  const [confidenceLevel, setConfidenceLevel] = useState("");
  const [isClosetEditing, setIsClosetEditing] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isMemoryOpen, setIsMemoryOpen] = useState(false);
  const [memoryPreview, setMemoryPreview] = useState<string[]>([]);

  useEffect(() => {
    let state = readOnboardingState();

    if (!state.survey.current_style || !state.survey.motivation || !state.survey.budget) {
      router.replace("/programs/style/onboarding/survey");
      return;
    }

    const shouldResetForNewPhoto =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("reset") === "photo";

    if (shouldResetForNewPhoto) {
      const preservedHistory =
        (state.feedback_history?.length ?? 0) > 0
          ? state.feedback_history
          : buildHistoryFromState(state);

      state = patchOnboardingState({
        image: undefined,
        text_description: undefined,
        feedback: undefined,
        daily_feedbacks: {},
        deep_dive_feedbacks: {},
        try_on_previews: {},
        feedback_history: preservedHistory,
        fallback_message: undefined
      });
      router.replace("/programs/style/onboarding/upload", { scroll: false });
    }

    setImage(state.image);
    setTextDescription(state.text_description);
    setClosetProfile({
      ...emptyClosetProfile,
      ...state.closet_profile
    });
    setClosetItems(
      normalizeClosetItems(state.closet_items).length
        ? normalizeClosetItems(state.closet_items)
        : buildClosetItemsFromProfile(state.closet_profile)
    );
    setSizeProfile(normalizeSizeProfile(state.size_profile));
    setStyleGoal(state.survey.style_goal || defaultStyleGoal);
    setConfidenceLevel(state.survey.confidence_level || defaultConfidenceLevel);
    setMemoryPreview(getRecentHistoryPreview(state, 2));
  }, [router]);

  const hasPhotoInput = Boolean(image || isValidTextDescription(textDescription));
  const closetReadiness = getMinimumClosetReadiness(closetItems);
  const hasClosetInput = closetReadiness.isReady;
  const hasInput = hasPhotoInput && hasClosetInput;
  const missingClosetLabels = closetReadiness.missingCategories.map(getClosetCategoryLabel);

  return (
    <main className="app-shell space-y-7">
      <div className="space-y-5 pt-4">
        <div className="app-header">
          <div className="flex items-center gap-4">
            <button
              className="app-back-button"
              onClick={() => router.push("/programs/style/onboarding/survey")}
              type="button"
            >
              ←
            </button>
            <p className="app-brand">RE:MAN</p>
          </div>
          <AccountAccessButton />
        </div>
        <div className="space-y-2">
          <div className="h-1 w-full bg-black/10">
            <div className="h-full w-2/3 bg-black" />
          </div>
          <p className="text-[13px] font-bold uppercase tracking-[0.24em] text-muted">
            Step 02 / 03
          </p>
        </div>
        <div className="screen-hero">
          <h1 className="screen-title">사진이 기준입니다</h1>
          <p className="screen-copy">전신, 정면, 밝은 곳.</p>
        </div>
      </div>
      <section className="upload-step-card">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="poster-kicker">Primary Input</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-ink">
              사진부터 준비합니다
            </h2>
          </div>
          <p className="text-right text-xs font-black uppercase tracking-[0.14em] text-muted">
            {hasPhotoInput ? "Ready" : "Required"}
          </p>
        </div>
        <PhotoUploader
          image={image}
          onChange={({ image: nextImage, text_description }) => {
            setImage(nextImage);
            setTextDescription(text_description);
          }}
          textDescription={textDescription}
        />
      </section>
      <div className="space-y-7 pb-24">
        {memoryPreview.length > 0 ? (
          <section className="upload-memory-card">
            <button
              aria-expanded={isMemoryOpen}
              className="upload-memory-trigger"
              onClick={() => setIsMemoryOpen((current) => !current)}
              type="button"
            >
              <span>
                <span className="poster-kicker">Memory</span>
                <strong>이전 반응 반영</strong>
                <small>{memoryPreview.length}개 기록을 참고합니다</small>
              </span>
              <span>{isMemoryOpen ? "접기" : "보기"}</span>
            </button>
            {isMemoryOpen ? (
              <div className="grid gap-2 border-t pt-4">
                {memoryPreview.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="upload-step-card">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="poster-kicker">Closet Context</p>
              <h2 className="mt-2 text-[28px] font-black leading-[1.05] tracking-[-0.05em] text-ink">
                옷장 사진
              </h2>
            </div>
            <p className="text-right text-xs font-black uppercase tracking-[0.14em] text-muted">
              {closetItems.length} items
            </p>
          </div>
          <div className="upload-closet-summary">
            <div>
              <p>{hasClosetInput ? "옷장 준비됨" : "옷장 필요"}</p>
              <span>
                {hasClosetInput
                  ? "상의, 하의, 신발 준비됨"
                  : `${missingClosetLabels.join(", ")} 필요`}
              </span>
            </div>
            <button
              onClick={() => setIsClosetEditing((current) => !current)}
              type="button"
            >
              {isClosetEditing ? "닫기" : hasClosetInput ? "수정" : "옷장 추가"}
            </button>
          </div>
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
          {isClosetEditing || !hasClosetInput ? (
            <ClosetInventoryEditor
              items={closetItems}
              onChange={(nextItems) => {
                setClosetItems(nextItems);
                setIsClosetEditing(true);
              }}
            />
          ) : null}
        </section>
        <section className="upload-step-card">
          <button
            aria-expanded={isAdvancedOpen}
            className="upload-advanced-trigger"
            onClick={() => setIsAdvancedOpen((current) => !current)}
            type="button"
          >
            <span>
              <span className="poster-kicker">Options</span>
              <strong>분석 기준</strong>
              <small>{styleGoal} · {confidenceLevel}</small>
            </span>
            <span>{isAdvancedOpen ? "닫기" : "변경"}</span>
          </button>
          {isAdvancedOpen ? (
            <div className="upload-advanced-panel">
              <div className="space-y-3">
                <p className="text-sm font-black text-ink">목표</p>
                <div className="grid gap-2">
                  {styleGoals.map((goal) => {
                    const selected = styleGoal === goal;

                    return (
                      <button
                        key={goal}
                        aria-pressed={selected}
                        className={`ui-choice flex items-center justify-between py-3 text-sm ${selected ? "ui-choice-selected" : ""}`}
                        onClick={() => setStyleGoal(goal)}
                        type="button"
                      >
                        <span>{goal}</span>
                        <span>{selected ? "선택됨" : "→"}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-sm font-black text-ink">자신감</p>
                <div className="grid grid-cols-4 gap-2">
                  {confidenceLevels.map((item) => (
                    <button
                      key={item}
                      aria-pressed={confidenceLevel === item}
                      className={`ui-choice px-2 py-3 text-center text-sm ${confidenceLevel === item ? "ui-choice-selected" : ""}`}
                      onClick={() => setConfidenceLevel(item)}
                      type="button"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
              <label className="grid gap-2">
                <span className="text-sm font-black text-ink">피하고 싶은 것</span>
                <input
                  className="ui-input"
                  onChange={(event) =>
                    setClosetProfile((current) => ({
                      ...current,
                      avoid: event.target.value
                    }))
                  }
                  placeholder="예: 너무 튀는 색, 꽉 끼는 옷"
                  value={closetProfile.avoid ?? ""}
                />
              </label>
              <SizeProfileEditor profile={sizeProfile} onChange={setSizeProfile} />
            </div>
          ) : null}
        </section>
      </div>
      <BottomCTA
        disabled={!hasInput}
        label="AI 분석 시작하기"
        onClick={() => {
          const currentState = readOnboardingState();
          const savedStyleSettings = readSavedStyleSettings();
          const nextStyleGoal =
            styleGoal === defaultStyleGoal &&
            currentState.survey.style_goal &&
            currentState.survey.style_goal !== defaultStyleGoal
              ? currentState.survey.style_goal
              : styleGoal;
          const nextConfidenceLevel =
            confidenceLevel === defaultConfidenceLevel &&
            currentState.survey.confidence_level &&
            currentState.survey.confidence_level !== defaultConfidenceLevel
              ? currentState.survey.confidence_level
              : confidenceLevel;
          const nextAvoid =
            closetProfile.avoid ||
            currentState.closet_profile?.avoid ||
            savedStyleSettings?.avoid ||
            "";
          const nextClosetProfile = buildClosetProfileFromItems(
            closetItems,
            nextAvoid
          );
          const nextState = patchOnboardingState({
            survey: {
              ...currentState.survey,
              style_goal: nextStyleGoal,
              confidence_level: nextConfidenceLevel
            },
            closet_profile: nextClosetProfile,
            closet_items: closetItems,
            size_profile: sizeProfile,
            image,
            text_description: isValidTextDescription(textDescription)
              ? normalizeTextDescription(textDescription)
              : undefined,
            feedback: undefined,
            daily_feedbacks: {},
            deep_dive_feedbacks: {},
            try_on_previews: {},
            feedback_history: currentState.feedback_history ?? [],
            fallback_message: undefined
          });
          void syncSurveyToFirestore(nextState);
          router.push("/programs/style/onboarding/analyzing");
        }}
      />
    </main>
  );
}
