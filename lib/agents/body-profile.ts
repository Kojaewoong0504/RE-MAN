import type { BodyFitRiskTag, BodyProfile } from "@/lib/agents/contracts";

const BODY_RISK_TAGS: BodyFitRiskTag[] = [
  "tight_top_risk",
  "cropped_top_risk",
  "strong_contrast_split_risk",
  "skinny_bottom_risk",
  "heavy_neckline_risk"
];

function isSignalLevel(value: unknown): value is "low" | "medium" | "high" {
  return value === "low" || value === "medium" || value === "high";
}

function isLegImpression(value: unknown): value is "shorter" | "balanced" | "longer" {
  return value === "shorter" || value === "balanced" || value === "longer";
}

function isShoulderShape(value: unknown): value is "rounded" | "narrow" | "balanced" {
  return value === "rounded" || value === "narrow" || value === "balanced";
}

function isNeckImpression(value: unknown): value is "short" | "balanced" | "long" {
  return value === "short" || value === "balanced" || value === "long";
}

function isFrame(value: unknown): value is "large" | "medium" | "compact" {
  return value === "large" || value === "medium" || value === "compact";
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function mergeRiskTags(
  current: BodyFitRiskTag[] | undefined,
  incoming: BodyFitRiskTag[]
): BodyFitRiskTag[] | undefined {
  const merged = [...(current ?? [])];

  for (const tag of incoming) {
    if (!merged.includes(tag)) {
      merged.push(tag);
    }
  }

  return merged.length ? merged : undefined;
}

export function normalizeBodyProfile(value: unknown): BodyProfile | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const raw = value as Record<string, unknown>;
  const fitRiskTags = Array.isArray(raw.fit_risk_tags)
    ? raw.fit_risk_tags.filter(
        (item): item is BodyFitRiskTag =>
          typeof item === "string" && BODY_RISK_TAGS.includes(item as BodyFitRiskTag)
      )
    : undefined;

  const normalized: BodyProfile = {
    upper_body_presence: isSignalLevel(raw.upper_body_presence)
      ? raw.upper_body_presence
      : undefined,
    lower_body_balance: isSignalLevel(raw.lower_body_balance)
      ? raw.lower_body_balance
      : undefined,
    belly_visibility: isSignalLevel(raw.belly_visibility)
      ? raw.belly_visibility
      : undefined,
    leg_length_impression: isLegImpression(raw.leg_length_impression)
      ? raw.leg_length_impression
      : undefined,
    shoulder_shape: isShoulderShape(raw.shoulder_shape) ? raw.shoulder_shape : undefined,
    neck_impression: isNeckImpression(raw.neck_impression) ? raw.neck_impression : undefined,
    overall_frame: isFrame(raw.overall_frame) ? raw.overall_frame : undefined,
    fit_risk_tags: fitRiskTags?.length ? fitRiskTags : undefined
  };

  return Object.values(normalized).some((item) => item !== undefined) ? normalized : undefined;
}

export function enrichBodyProfileFromFeedbackText(
  bodyProfile: BodyProfile | undefined,
  input: {
    diagnosis?: string;
    outfitReason?: string;
  }
): BodyProfile | undefined {
  const base = normalizeBodyProfile(bodyProfile) ?? {};
  const text = `${input.diagnosis ?? ""} ${input.outfitReason ?? ""}`.replace(/\s+/g, " ").trim();

  if (!text) {
    return normalizeBodyProfile(base);
  }

  let next: BodyProfile = { ...base };
  const inferredRiskTags: BodyFitRiskTag[] = [];

  if (
    includesAny(text, [
      "상체가 먼저 보",
      "상체 볼륨",
      "덩치가 부각",
      "덩치가 덜 부각",
      "상체가 커 보",
      "부해 보",
      "체형이 커 보"
    ])
  ) {
    if (next.upper_body_presence !== "high") {
      next.upper_body_presence = "high";
    }
  }

  if (
    includesAny(text, [
      "덩치가 부각",
      "덩치가 덜 부각",
      "덩치가 커 보",
      "체격이 커 보",
      "부해 보",
      "체형이 커 보"
    ])
  ) {
    if (next.overall_frame !== "large") {
      next.overall_frame = "large";
    }
  }

  if (includesAny(text, ["비율이 더 안정적", "다리가 짧아", "다리 비율", "길어 보"])) {
    if (next.leg_length_impression !== "shorter" && includesAny(text, ["다리가 짧", "비율이 더 안정", "길어 보"])) {
      next.leg_length_impression = "shorter";
    }
  }

  if (includesAny(text, ["대비가 강", "강한 대비", "상하의 대비"])) {
    inferredRiskTags.push("strong_contrast_split_risk");
  }

  if (includesAny(text, ["목이 답답", "목선이 답답", "목을 덮"])) {
    if (next.neck_impression !== "short") {
      next.neck_impression = "short";
    }
    inferredRiskTags.push("heavy_neckline_risk");
  }

  if (includesAny(text, ["오버핏", "상체 볼륨", "부피감", "너무 큰 상의"])) {
    inferredRiskTags.push("tight_top_risk");
  }

  next = {
    ...next,
    fit_risk_tags: mergeRiskTags(next.fit_risk_tags, inferredRiskTags)
  };

  return normalizeBodyProfile(next);
}
