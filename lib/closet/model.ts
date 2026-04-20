import type { ClosetProfile } from "@/lib/agents/contracts";

export type ClosetItemCategory = "tops" | "bottoms" | "shoes" | "outerwear";

export type ClosetItem = {
  id: string;
  category: ClosetItemCategory;
  name: string;
  photo_data_url?: string;
  image_url?: string;
  storage_bucket?: string;
  storage_path?: string;
  color?: string;
  fit?: string;
  size?: string;
  wear_state?: string;
  wear_frequency?: string;
  season?: string;
  condition?: string;
  notes?: string;
};

export type SizeProfile = {
  height_cm?: string;
  weight_kg?: string;
  top_size?: string;
  bottom_size?: string;
  shoe_size_mm?: string;
  fit_preference?: string;
};

const closetCategories = ["tops", "bottoms", "shoes", "outerwear"] as const;
const sizeProfileKeys = [
  "height_cm",
  "weight_kg",
  "top_size",
  "bottom_size",
  "shoe_size_mm",
  "fit_preference"
] as const satisfies ReadonlyArray<keyof SizeProfile>;

function isClosetItemCategory(value: unknown): value is ClosetItemCategory {
  return (
    typeof value === "string" &&
    closetCategories.includes(value as ClosetItemCategory)
  );
}

function compactClosetItemText(item: ClosetItem) {
  const name = item.name.trim() || "옷장 사진";
  const color = item.color?.trim();
  const shouldPrefixColor = Boolean(color && !name.includes(color));

  return [
    shouldPrefixColor ? color : null,
    name,
    item.fit ? `(${item.fit})` : null,
    item.size ? `[${item.size}]` : null,
    item.wear_state ? `{${item.wear_state}}` : null,
    item.wear_frequency ? `빈도:${item.wear_frequency}` : null,
    item.season ? `계절:${item.season}` : null,
    item.condition ? `상태:${item.condition}` : null,
    item.notes ? `- ${item.notes}` : null
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeClosetItems(items: unknown): ClosetItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item, index): ClosetItem | null => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const category = isClosetItemCategory(record.category) ? record.category : null;
      const name = typeof record.name === "string" ? record.name.trim() : "";
      const photoDataUrl =
        typeof record.photo_data_url === "string" && record.photo_data_url.startsWith("data:image/")
          ? record.photo_data_url
          : "";
      const imageUrl =
        typeof record.image_url === "string" && record.image_url.trim()
          ? record.image_url.trim()
          : "";
      const storageBucket =
        typeof record.storage_bucket === "string" && record.storage_bucket.trim()
          ? record.storage_bucket.trim()
          : "";
      const storagePath =
        typeof record.storage_path === "string" && record.storage_path.trim()
          ? record.storage_path.trim()
          : "";

      if (!category || (!name && !photoDataUrl && !imageUrl)) {
        return null;
      }

      return {
        id:
          typeof record.id === "string" && record.id.trim()
            ? record.id.trim()
            : `closet-${index}`,
        category,
        name: name || `옷장 사진 ${index + 1}`,
        photo_data_url: photoDataUrl,
        image_url: imageUrl,
        storage_bucket: storageBucket,
        storage_path: storagePath,
        color: typeof record.color === "string" ? record.color.trim() : "",
        fit: typeof record.fit === "string" ? record.fit.trim() : "",
        size: typeof record.size === "string" ? record.size.trim() : "",
        wear_state: typeof record.wear_state === "string" ? record.wear_state.trim() : "",
        wear_frequency:
          typeof record.wear_frequency === "string" ? record.wear_frequency.trim() : "",
        season: typeof record.season === "string" ? record.season.trim() : "",
        condition: typeof record.condition === "string" ? record.condition.trim() : "",
        notes: typeof record.notes === "string" ? record.notes.trim() : ""
      };
    })
    .filter((item): item is ClosetItem => Boolean(item));
}

export function buildClosetProfileFromItems(
  items: ClosetItem[] | undefined,
  avoid?: string
): ClosetProfile {
  const normalizedItems = normalizeClosetItems(items);
  const byCategory = closetCategories.reduce<Record<ClosetItemCategory, string[]>>(
    (acc, category) => {
      acc[category] = [];
      return acc;
    },
    {} as Record<ClosetItemCategory, string[]>
  );

  normalizedItems.forEach((item) => {
    byCategory[item.category].push(compactClosetItemText(item));
  });

  return {
    tops: byCategory.tops.join(", "),
    bottoms: byCategory.bottoms.join(", "),
    shoes: byCategory.shoes.join(", "),
    outerwear: byCategory.outerwear.join(", "),
    avoid: avoid?.trim() ?? ""
  };
}

export function normalizeSizeProfile(input: unknown): SizeProfile {
  if (!input || typeof input !== "object") {
    return {};
  }

  const record = input as Record<string, unknown>;

  return sizeProfileKeys.reduce<SizeProfile>((acc, key) => {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      acc[key] = value.trim();
    }

    return acc;
  }, {});
}
