import type { ClosetItem, SizeProfile } from "@/lib/onboarding/storage";

export type SizeCandidate = {
  category: "tops" | "bottoms" | "shoes";
  label: string;
  referenceItem: string;
  size: string;
  checkPoint: string;
  closetEvidence?: {
    itemName: string;
    size: string;
    wearState?: string;
    condition?: string;
  };
};

function parseNumber(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number(value.replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function inferTopSize(profile: SizeProfile) {
  if (profile.top_size?.trim()) {
    return profile.top_size.trim().toUpperCase();
  }

  const weight = parseNumber(profile.weight_kg);

  if (!weight) {
    return null;
  }

  if (weight < 65) {
    return "M";
  }

  if (weight < 80) {
    return "L";
  }

  return "XL";
}

function inferBottomSize(profile: SizeProfile) {
  if (profile.bottom_size?.trim()) {
    return profile.bottom_size.trim();
  }

  const weight = parseNumber(profile.weight_kg);

  if (!weight) {
    return null;
  }

  if (weight < 65) {
    return "30";
  }

  if (weight < 80) {
    return "32";
  }

  return "34";
}

function inferShoeSize(profile: SizeProfile) {
  if (profile.shoe_size_mm?.trim()) {
    return profile.shoe_size_mm.trim();
  }

  return null;
}

function getCheckPoint(category: SizeCandidate["category"], profile: SizeProfile) {
  if (category === "tops") {
    return profile.fit_preference
      ? `${profile.fit_preference} 기준으로 어깨선과 총장을 먼저 확인`
      : "어깨선과 총장을 먼저 확인";
  }

  if (category === "bottoms") {
    return "허리 여유와 밑단 길이를 먼저 확인";
  }

  return "발볼과 앞코 여유를 먼저 확인";
}

function getClosetItemDisplayName(item: ClosetItem) {
  const color = item.color?.trim();
  const name = item.name.trim();

  if (!color || name.includes(color)) {
    return name;
  }

  return `${color} ${name}`;
}

function findClosetEvidence(input: {
  category: SizeCandidate["category"];
  size: string;
  closetItems?: ClosetItem[];
}): SizeCandidate["closetEvidence"] {
  const candidates = input.closetItems?.filter(
    (item) => item.category === input.category && item.size?.trim()
  );

  if (!candidates?.length) {
    return undefined;
  }

  const sameSize = candidates.find(
    (item) => item.size?.trim().toUpperCase() === input.size.toUpperCase()
  );
  const reliable = candidates.find((item) => item.wear_state?.includes("잘 맞"));
  const selected = sameSize ?? reliable ?? candidates[0];

  return {
    itemName: getClosetItemDisplayName(selected),
    size: selected.size?.trim() ?? input.size,
    wearState: selected.wear_state || undefined,
    condition: selected.condition || undefined
  };
}

export function buildSizeCandidates(input: {
  sizeProfile?: SizeProfile;
  recommendedItems: [string, string, string];
  closetItems?: ClosetItem[];
}): SizeCandidate[] {
  const profile = input.sizeProfile ?? {};
  const candidates: SizeCandidate[] = [];
  const topSize = inferTopSize(profile);
  const bottomSize = inferBottomSize(profile);
  const shoeSize = inferShoeSize(profile);

  if (topSize) {
    candidates.push({
      category: "tops",
      label: "상의 사이즈 후보",
      referenceItem: input.recommendedItems[0],
      size: topSize,
      checkPoint: getCheckPoint("tops", profile),
      closetEvidence: findClosetEvidence({
        category: "tops",
        size: topSize,
        closetItems: input.closetItems
      })
    });
  }

  if (bottomSize) {
    candidates.push({
      category: "bottoms",
      label: "하의 사이즈 후보",
      referenceItem: input.recommendedItems[1],
      size: bottomSize,
      checkPoint: getCheckPoint("bottoms", profile),
      closetEvidence: findClosetEvidence({
        category: "bottoms",
        size: bottomSize,
        closetItems: input.closetItems
      })
    });
  }

  if (shoeSize) {
    candidates.push({
      category: "shoes",
      label: "신발 사이즈 후보",
      referenceItem: input.recommendedItems[2],
      size: shoeSize,
      checkPoint: getCheckPoint("shoes", profile),
      closetEvidence: findClosetEvidence({
        category: "shoes",
        size: shoeSize,
        closetItems: input.closetItems
      })
    });
  }

  return candidates;
}
