import { NextResponse } from "next/server";
import { getAuthenticatedSessionUser } from "@/lib/auth/session-user";
import { analyzeClosetImage } from "@/lib/closet/analysis-provider";

export async function POST(request: Request) {
  const user = await getAuthenticatedSessionUser().catch((error) => {
    if (error instanceof Error && error.message.endsWith("access_token")) {
      return null;
    }

    throw error;
  });

  if (!user) {
    return NextResponse.json({ error: "missing_access_token" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);

  if (
    !body ||
    typeof body !== "object" ||
    typeof (body as { image?: unknown }).image !== "string" ||
    !(body as { image: string }).image.startsWith("data:image/")
  ) {
    return NextResponse.json({ error: "invalid_image" }, { status: 400 });
  }

  try {
    const result = await analyzeClosetImage({ image: (body as { image: string }).image });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "analysis_failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
