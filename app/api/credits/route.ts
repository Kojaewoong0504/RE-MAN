import { NextResponse } from "next/server";
import { getAuthenticatedSessionUser } from "@/lib/auth/session-user";
import { getCreditAuditSnapshotAsync } from "@/lib/credits/server";

export async function GET() {
  try {
    const user = await getAuthenticatedSessionUser();
    const audit = await getCreditAuditSnapshotAsync(user.uid);

    if (!audit.ok) {
      return NextResponse.json(
        {
          error: "credit_ledger_mismatch",
          mismatches: audit.mismatches
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ...audit.balance,
      ledger_ok: audit.ok,
      ledger_transaction_count: audit.transaction_count,
      latest_transaction_id: audit.latest_transaction_id
    });
  } catch (error) {
    if (error instanceof Error && error.message.endsWith("access_token")) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json({ error: "credits_failed" }, { status: 500 });
  }
}
