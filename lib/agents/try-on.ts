import {
  TRY_ON_MAX_IMAGE_BYTES,
  TRY_ON_MAX_PROMPT_LENGTH
} from "@/lib/agents/try-on-contract";
import { execFileSync } from "node:child_process";
import { importPKCS8, SignJWT } from "jose";

export type TryOnRequest = {
  person_image: string;
  product_image: string;
  prompt: string;
  user_id?: string;
};

export type TryOnResponse = {
  status: "mocked" | "vertex";
  preview_image: string;
  message: string;
};
export type TryOnErrorCode =
  | "missing_vertex_config"
  | "vertex_http_error"
  | "vertex_output_uri_only"
  | "empty_vertex_response"
  | "invalid_try_on_image";

export class TryOnProviderError extends Error {
  code: TryOnErrorCode;
  statusHint: number;

  constructor(code: TryOnErrorCode, message: string, statusHint = 502) {
    super(message);
    this.name = "TryOnProviderError";
    this.code = code;
    this.statusHint = statusHint;
  }
}

const dataImagePattern = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

type ParsedDataImage = {
  mimeType: string;
  base64: string;
};

type VertexTryOnPrediction = {
  mimeType?: string;
  bytesBase64Encoded?: string;
  gcsUri?: string;
  images?: Array<{
    mimeType?: string;
    bytesBase64Encoded?: string;
    gcsUri?: string;
    raiFilteredReason?: string;
  }>;
};

type VertexTryOnResponse = {
  predictions?: VertexTryOnPrediction[];
};

export type TryOnRuntimeStatus = {
  provider: "mock" | "vertex";
  real_generation_enabled: boolean;
  model_id: string;
  missing_config: string[];
  auth_source: "env" | "gcloud" | "service_account" | "missing";
};

const DEFAULT_VERTEX_TRY_ON_MODEL = "virtual-try-on-001";
const GOOGLE_OAUTH_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_CLOUD_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const SERVICE_ACCOUNT_TOKEN_TTL_SECONDS = 3600;
const SERVICE_ACCOUNT_TOKEN_REFRESH_BUFFER_SECONDS = 60;

let cachedServiceAccountToken:
  | {
      accessToken: string;
      expiresAt: number;
    }
  | null = null;

function getBase64ByteLength(base64: string) {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function isDataImage(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  const matched = value.match(dataImagePattern);

  if (!matched) {
    return false;
  }

  return getBase64ByteLength(matched[2]) <= TRY_ON_MAX_IMAGE_BYTES;
}

function parseDataImage(value: string): ParsedDataImage {
  const matched = value.match(dataImagePattern);

  if (!matched) {
    throw new TryOnProviderError("invalid_try_on_image", "invalid_try_on_image", 400);
  }

  return {
    mimeType: `image/${matched[1]}`,
    base64: matched[2]
  };
}

function isNonEmptyString(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= TRY_ON_MAX_PROMPT_LENGTH
  );
}

export function validateTryOnRequest(payload: unknown): payload is TryOnRequest {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const request = payload as Record<string, unknown>;
  return (
    isDataImage(request.person_image) &&
    isDataImage(request.product_image) &&
    isNonEmptyString(request.prompt)
  );
}

export function resolveTryOnProvider() {
  return process.env.TRY_ON_PROVIDER === "vertex" ? "vertex" : "mock";
}

function getVertexModelId() {
  return process.env.VERTEX_TRY_ON_MODEL ?? DEFAULT_VERTEX_TRY_ON_MODEL;
}

function getLocalGcloudAccessToken() {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  try {
    const token = execFileSync("gcloud", ["auth", "print-access-token"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5000
    }).trim();

    return token || null;
  } catch {
    return null;
  }
}

export function resolvePreferredVertexAccessToken(input: {
  nodeEnv: string | undefined;
  envToken: string | undefined;
  gcloudToken: string | null;
  serviceAccountToken: string | null;
}) {
  if (input.nodeEnv !== "production" && input.gcloudToken) {
    return input.gcloudToken;
  }

  return input.serviceAccountToken || input.envToken || input.gcloudToken || null;
}

function getFirebaseServiceAccountEmail() {
  return process.env.FIREBASE_CLIENT_EMAIL?.trim() || null;
}

function getFirebaseServiceAccountPrivateKey() {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!privateKey?.trim()) {
    return null;
  }

  return privateKey.replace(/\\n/g, "\n");
}

function hasFirebaseServiceAccountConfig() {
  return Boolean(getFirebaseServiceAccountEmail() && getFirebaseServiceAccountPrivateKey());
}

async function mintServiceAccountAccessToken() {
  const cached = cachedServiceAccountToken;

  if (
    cached &&
    cached.expiresAt - Date.now() >
      SERVICE_ACCOUNT_TOKEN_REFRESH_BUFFER_SECONDS * 1000
  ) {
    return cached.accessToken;
  }

  const clientEmail = getFirebaseServiceAccountEmail();
  const privateKey = getFirebaseServiceAccountPrivateKey();

  if (!clientEmail || !privateKey) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const key = await importPKCS8(privateKey, "RS256");
  const assertion = await new SignJWT({ scope: GOOGLE_CLOUD_SCOPE })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(clientEmail)
    .setSubject(clientEmail)
    .setAudience(GOOGLE_OAUTH_TOKEN_ENDPOINT)
    .setIssuedAt(now)
    .setExpirationTime(now + SERVICE_ACCOUNT_TOKEN_TTL_SECONDS)
    .sign(key);

  const response = await fetch(GOOGLE_OAUTH_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    }).toString()
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const excerpt = body.replace(/\s+/g, " ").slice(0, 500);
    throw new TryOnProviderError(
      "vertex_http_error",
      `service_account_token_http_${response.status}:${excerpt || "empty_error_body"}`,
      response.status === 401 || response.status === 403 ? 502 : 503
    );
  }

  const data = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!data.access_token) {
    throw new TryOnProviderError(
      "vertex_http_error",
      "service_account_token_missing_access_token",
      503
    );
  }

  cachedServiceAccountToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? SERVICE_ACCOUNT_TOKEN_TTL_SECONDS) * 1000
  };

  return data.access_token;
}

async function getVertexAccessToken() {
  const envToken = process.env.VERTEX_ACCESS_TOKEN;
  const gcloudToken = getLocalGcloudAccessToken();
  const serviceAccountToken = hasFirebaseServiceAccountConfig()
    ? await mintServiceAccountAccessToken()
    : null;

  return resolvePreferredVertexAccessToken({
    nodeEnv: process.env.NODE_ENV,
    envToken,
    gcloudToken,
    serviceAccountToken
  });
}

function getVertexAuthSource(): TryOnRuntimeStatus["auth_source"] {
  const envToken = process.env.VERTEX_ACCESS_TOKEN;
  const gcloudToken = getLocalGcloudAccessToken();
  const hasServiceAccount = hasFirebaseServiceAccountConfig();
  const preferred = resolvePreferredVertexAccessToken({
    nodeEnv: process.env.NODE_ENV,
    envToken,
    gcloudToken,
    serviceAccountToken: hasServiceAccount ? "service-account" : null
  });

  if (!preferred) {
    return "missing";
  }

  if (process.env.NODE_ENV !== "production" && gcloudToken && preferred === gcloudToken) {
    return "gcloud";
  }

  if (hasServiceAccount && preferred === "service-account") {
    return "service_account";
  }

  if (envToken) {
    return "env";
  }

  if (gcloudToken) {
    return "gcloud";
  }

  return "missing";
}

export function getTryOnRuntimeStatus(): TryOnRuntimeStatus {
  const provider = resolveTryOnProvider();
  const missingConfig = [];

  if (provider === "vertex" && !process.env.VERTEX_PROJECT_ID) {
    missingConfig.push("VERTEX_PROJECT_ID");
  }

  if (provider === "vertex" && !process.env.VERTEX_LOCATION) {
    missingConfig.push("VERTEX_LOCATION");
  }

  const authSource = getVertexAuthSource();

  if (provider === "vertex" && authSource === "missing") {
    missingConfig.push("VERTEX_ACCESS_TOKEN or gcloud auth or Firebase service account");
  }

  return {
    provider,
    real_generation_enabled: provider === "vertex" && missingConfig.length === 0,
    model_id: getVertexModelId(),
    missing_config: missingConfig,
    auth_source: authSource
  };
}

async function getVertexConfig() {
  const projectId = process.env.VERTEX_PROJECT_ID;
  const location = process.env.VERTEX_LOCATION;
  const accessToken = await getVertexAccessToken();
  const storageUri = process.env.VERTEX_TRY_ON_STORAGE_URI;
  const modelId = getVertexModelId();

  if (!projectId || !location || !accessToken) {
    throw new TryOnProviderError(
      "missing_vertex_config",
      "missing_vertex_try_on_config",
      503
    );
  }

  return {
    projectId,
    location,
    accessToken,
    storageUri,
    modelId
  };
}

async function generateVertexTryOnPreview(payload: TryOnRequest): Promise<TryOnResponse> {
  const config = await getVertexConfig();
  const personImage = parseDataImage(payload.person_image);
  const productImage = parseDataImage(payload.product_image);
  const endpoint = `https://${config.location}-aiplatform.googleapis.com/v1/projects/${config.projectId}/locations/${config.location}/publishers/google/models/${config.modelId}:predict`;
  const parameters = {
    sampleCount: 1,
    ...(config.storageUri ? { storageUri: config.storageUri } : {})
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify({
      instances: [
        {
          personImage: {
            image: {
              bytesBase64Encoded: personImage.base64
            }
          },
          productImages: [
            {
              image: {
                bytesBase64Encoded: productImage.base64
              }
            }
          ]
        }
      ],
      parameters
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const excerpt = body.replace(/\s+/g, " ").slice(0, 500);
    throw new TryOnProviderError(
      "vertex_http_error",
      `vertex_try_on_http_${response.status}:${excerpt || "empty_error_body"}`,
      response.status === 401 || response.status === 403 ? 502 : 503
    );
  }

  const data = (await response.json()) as VertexTryOnResponse;
  const prediction = data.predictions?.[0];
  const image = prediction?.images?.[0] ?? prediction;

  if (!image?.bytesBase64Encoded) {
    if (image?.gcsUri) {
      throw new TryOnProviderError(
        "vertex_output_uri_only",
        "vertex_try_on_returned_gcs_uri_without_inline_bytes",
        502
      );
    }

    throw new TryOnProviderError(
      "empty_vertex_response",
      "empty_vertex_try_on_response",
      502
    );
  }

  return {
    status: "vertex",
    preview_image: `data:${image.mimeType ?? "image/png"};base64,${image.bytesBase64Encoded}`,
    message: "Vertex AI Virtual Try-On 실착 미리보기가 준비됐습니다."
  };
}

export async function generateTryOnPreview(payload: TryOnRequest): Promise<TryOnResponse> {
  if (resolveTryOnProvider() === "vertex") {
    return generateVertexTryOnPreview(payload);
  }

  return {
    status: "mocked",
    preview_image: payload.person_image,
    message:
      "로컬 mock try-on입니다. 실제 실착 생성은 Vertex AI Virtual Try-On provider 구현 후 활성화합니다."
  };
}
