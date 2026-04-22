import type { ClosetItem } from "@/lib/onboarding/storage";

export type ClosetPreviewMap = Record<string, string>;

function isPreviewRequestTarget(item: ClosetItem) {
  return Boolean(item.storage_bucket && item.storage_path && !item.photo_data_url);
}

export function buildClosetPreviewRequestKey(items: ClosetItem[]) {
  return items
    .filter(isPreviewRequestTarget)
    .map((item) => `${item.id}:${item.storage_bucket}:${item.storage_path}`)
    .sort()
    .join("|");
}

export async function fetchClosetPreviewUrls(items: ClosetItem[]): Promise<ClosetPreviewMap> {
  const requestItems = items.filter(isPreviewRequestTarget);

  if (!requestItems.length) {
    return {};
  }

  const response = await fetch("/api/closet/previews", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ items: requestItems })
  });

  const body = (await response.json().catch(() => null)) as
    | {
        previews?: Array<{ id?: string; preview_url?: string }>;
        error?: string;
      }
    | null;

  if (!response.ok) {
    throw new Error(body?.error ?? "closet_preview_fetch_failed");
  }

  return Object.fromEntries(
    (body?.previews ?? [])
      .filter(
        (item): item is { id: string; preview_url: string } =>
          typeof item.id === "string" &&
          item.id.length > 0 &&
          typeof item.preview_url === "string" &&
          item.preview_url.length > 0
      )
      .map((item) => [item.id, item.preview_url])
  );
}
