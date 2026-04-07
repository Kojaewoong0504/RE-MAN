import { NextResponse } from "next/server";
import {
  isStorageFailureError,
  recordStorageRuntimeFailure
} from "@/lib/harness/runtime-failures";
import { runSupabaseStorageSmokeTest } from "@/lib/supabase/storage";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as
    | { user_id?: string }
    | null;

  try {
    const imageRef = await runSupabaseStorageSmokeTest(payload?.user_id);

    return NextResponse.json({
      ok: true,
      bucket: imageRef.bucket,
      path: imageRef.path,
      deleted: true
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_supabase_storage_error";

    if (isStorageFailureError(error)) {
      await recordStorageRuntimeFailure({
        route: "storage-dev",
        error,
        userId: payload?.user_id
      });
    }

    return NextResponse.json(
      {
        ok: false,
        error: message
      },
      { status: 500 }
    );
  }
}
