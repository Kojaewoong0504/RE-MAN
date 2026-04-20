import { NextResponse } from "next/server";
import { getAuthenticatedSessionUser } from "@/lib/auth/session-user";
import { buildClosetProfileFromItems, normalizeClosetItems } from "@/lib/closet/model";
import { persistClosetItemsForUser } from "@/lib/closet/server-persistence";

export async function PUT(request: Request) {
  let user;

  try {
    user = await getAuthenticatedSessionUser();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "unauthorized" },
      { status: 401 }
    );
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        items?: unknown;
        closet_profile?: { avoid?: string } | null;
        size_profile?: Record<string, unknown> | null;
      }
    | null;

  if (!payload || !Array.isArray(payload.items)) {
    return NextResponse.json({ error: "invalid_closet_items" }, { status: 400 });
  }

  const items = normalizeClosetItems(payload.items);
  const fallbackProfile = buildClosetProfileFromItems(items, payload.closet_profile?.avoid ?? "");

  try {
    const result = await persistClosetItemsForUser({
      userId: user.uid,
      email: user.email,
      items,
      closetProfile: {
        ...fallbackProfile,
        avoid: payload.closet_profile?.avoid ?? ""
      },
      sizeProfile: payload.size_profile ?? undefined
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "closet_persist_failed"
      },
      { status: 500 }
    );
  }
}
