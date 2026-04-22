import { NextResponse } from "next/server";
import { getAuthenticatedSessionUser } from "@/lib/auth/session-user";
import { grantPaidCreditsAsync } from "@/lib/credits/server";

const DEV_GRANT_AMOUNT = 10;

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const user = await getAuthenticatedSessionUser().catch(() => null);

  if (!user) {
    return NextResponse.json({ error: "missing_access_token" }, { status: 401 });
  }

  const credits = await grantPaidCreditsAsync(user.uid, DEV_GRANT_AMOUNT);

  return NextResponse.json({
    granted: DEV_GRANT_AMOUNT,
    balance: credits.balance,
    paid_credits: credits.paid_credits,
    event_credits: credits.event_credits
  });
}
