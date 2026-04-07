import type { AgentRequest } from "@/lib/agents/contracts";
import {
  deleteImageFromSupabaseStorage,
  hasSupabaseStorageConfig,
  uploadImageToSupabaseStorage
} from "@/lib/supabase/storage";

export type StorageFailureMode = "none" | "upload" | "delete";

export async function withTemporaryStoredImage<T>(
  payload: AgentRequest,
  work: () => Promise<T>,
  failureMode: StorageFailureMode = "none"
) {
  if (!payload.image) {
    return work();
  }

  if (failureMode === "upload") {
    throw new Error("forced_supabase_upload_failure");
  }

  if (!hasSupabaseStorageConfig()) {
    const result = await work();

    if (failureMode === "delete") {
      throw new Error("forced_supabase_delete_failure");
    }

    return result;
  }

  const uploadedImage = await uploadImageToSupabaseStorage(payload.image, payload.user_id);

  try {
    const result = await work();

    if (failureMode === "delete") {
      throw new Error("forced_supabase_delete_failure");
    }

    return result;
  } finally {
    if (failureMode !== "delete") {
      await deleteImageFromSupabaseStorage(uploadedImage);
    }
  }
}
