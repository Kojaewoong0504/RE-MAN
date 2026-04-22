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
