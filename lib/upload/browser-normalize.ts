import {
  ANALYSIS_IMAGE_QUALITY,
  isHeicLikePhoto,
  MAX_ANALYSIS_IMAGE_EDGE
} from "@/lib/upload/photo-input";

function readImage(blob: Blob) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image_load_failed"));
    };
    image.src = url;
  });
}

async function transcodeHeicToJpegBlob(file: File) {
  const heic2any = (await import("heic2any")).default;
  const converted = await heic2any({
    blob: file,
    quality: ANALYSIS_IMAGE_QUALITY,
    toType: "image/jpeg"
  });

  const blob = Array.isArray(converted) ? converted[0] : converted;

  if (!blob) {
    throw new Error("heic_transcode_failed");
  }

  return blob;
}

export async function normalizePhotoForBrowserUpload(file: File) {
  const source = isHeicLikePhoto(file) ? await transcodeHeicToJpegBlob(file) : file;
  const image = await readImage(source);
  const scale = Math.min(
    1,
    MAX_ANALYSIS_IMAGE_EDGE / Math.max(image.naturalWidth, image.naturalHeight)
  );
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("canvas_context_unavailable");
  }

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", ANALYSIS_IMAGE_QUALITY);
}
