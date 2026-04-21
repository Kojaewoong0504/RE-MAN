import { NextResponse } from "next/server";
import { normalizeClosetItems } from "@/lib/closet/model";
import { getAuthenticatedSessionUser } from "@/lib/auth/session-user";
import { createSignedImageUrl, hasSupabaseStorageConfig } from "@/lib/supabase/storage";

export async function POST(request: Request) {
  try {
    await getAuthenticatedSessionUser();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "unauthorized" },
      { status: 401 }
    );
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        items?: unknown;
      }
    | null;

  if (!payload?.items) {
    return NextResponse.json({ error: "invalid_closet_items" }, { status: 400 });
  }

  const items = normalizeClosetItems(payload.items);

  if (!items.length) {
    return NextResponse.json({ previews: [] });
  }

  const previews = await Promise.all(
    items.map(async (item) => {
      if (item.photo_data_url) {
        return {
          id: item.id,
          preview_url: item.photo_data_url
        };
      }

      if (item.storage_bucket && item.storage_path && hasSupabaseStorageConfig()) {
        try {
          return {
            id: item.id,
            preview_url: await createSignedImageUrl({
              bucket: item.storage_bucket,
              path: item.storage_path
            })
          };
        } catch {
          return {
            id: item.id,
            preview_url: item.image_url ?? ""
          };
        }
      }

      return {
        id: item.id,
        preview_url: item.image_url ?? ""
      };
    })
  );

  return NextResponse.json({
    previews: previews.filter((item) => item.preview_url)
  });
}
