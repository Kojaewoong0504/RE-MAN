import { NextResponse } from "next/server";
import { getAuthenticatedSessionUser } from "@/lib/auth/session-user";
import { getCreditTransactionsAsync } from "@/lib/credits/server";

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedSessionUser();
    const url = new URL(request.url);
    const requestedLimit = Number(url.searchParams.get("limit") ?? "50");
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.floor(requestedLimit), 1), 100)
      : 50;

    return NextResponse.json({
      transactions: await getCreditTransactionsAsync(user.uid, limit)
    });
  } catch (error) {
    if (error instanceof Error && error.message.endsWith("access_token")) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json({ error: "credit_transactions_failed" }, { status: 500 });
  }
}
