import { createClient } from "@supabase/supabase-js";

type UploadedImageRef = {
  bucket: string;
  path: string;
};

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif"
]);
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL;
}

function getSupabaseServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function getSupabaseBucket() {
  return process.env.SUPABASE_STORAGE_BUCKET ?? "uploads";
}

export function hasSupabaseStorageConfig() {
  return Boolean(getSupabaseUrl() && getSupabaseServiceRoleKey() && getSupabaseBucket());
}

function getSupabaseStorageClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseServiceRoleKey();

  if (!url || !key) {
    throw new Error("missing_supabase_storage_config");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function parseDataUrl(image: string) {
  const matched = image.match(/^data:(.+?);base64,(.+)$/);

  if (!matched) {
    throw new Error("invalid_image_data_url");
  }

  const [, mimeType, data] = matched;
  const extension = mimeType.split("/")[1] ?? "jpg";
  const buffer = Buffer.from(data, "base64");

  if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
    throw new Error("unsupported_image_type");
  }

  if (buffer.byteLength > MAX_IMAGE_SIZE_BYTES) {
    throw new Error("image_too_large");
  }

  return {
    mimeType,
    buffer,
    extension
  };
}

export async function uploadImageToSupabaseStorage(image: string, userId?: string) {
  const client = getSupabaseStorageClient();
  const { mimeType, buffer, extension } = parseDataUrl(image);
  const safeUserId = userId?.trim() || "guest";
  const path = `${safeUserId}/${crypto.randomUUID()}.${extension}`;
  const bucket = getSupabaseBucket();

  const { error } = await client.storage.from(bucket).upload(path, buffer, {
    contentType: mimeType,
    upsert: false
  });

  if (error) {
    throw new Error(`supabase_upload_failed:${error.message}`);
  }

  return {
    bucket,
    path
  } satisfies UploadedImageRef;
}

export async function deleteImageFromSupabaseStorage(imageRef: UploadedImageRef) {
  const client = getSupabaseStorageClient();
  const { error } = await client.storage.from(imageRef.bucket).remove([imageRef.path]);

  if (error) {
    throw new Error(`supabase_delete_failed:${error.message}`);
  }
}

export async function runSupabaseStorageSmokeTest(userId?: string) {
  const testImage =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9s3FoX0AAAAASUVORK5CYII=";
  const uploadedImage = await uploadImageToSupabaseStorage(testImage, userId);

  await deleteImageFromSupabaseStorage(uploadedImage);

  return uploadedImage;
}
