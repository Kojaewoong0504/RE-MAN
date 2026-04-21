import type { ClosetItem } from "@/lib/onboarding/storage";

export type ClosetPreviewMap = Record<string, string>;

export async function fetchClosetPreviewUrls(items: ClosetItem[]): Promise<ClosetPreviewMap> {
  if (!items.length) {
    return {};
  }

  const response = await fetch("/api/closet/previews", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ items })
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
