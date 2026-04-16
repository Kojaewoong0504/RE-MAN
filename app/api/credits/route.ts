import { NextResponse } from "next/server";
import { getAuthenticatedSessionUser } from "@/lib/auth/session-user";
import { getCreditBalance } from "@/lib/credits/server";

export async function GET() {
  try {
    const user = await getAuthenticatedSessionUser();
    return NextResponse.json(getCreditBalance(user.uid));
  } catch (error) {
    if (error instanceof Error && error.message.endsWith("access_token")) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json({ error: "credits_failed" }, { status: 500 });
  }
}
