import { randomUUID } from "crypto";
import { createRemoteJWKSet, jwtVerify, SignJWT, type JWTPayload } from "jose";
import { SESSION_COOKIE_NAMES } from "@/lib/auth/constants";
import {
  getRefreshFamily,
  resetRefreshFamiliesForTests,
  revokeRefreshFamily,
  upsertRefreshFamily
} from "@/lib/auth/refresh-store";
import type { AuthUser, SessionTokens } from "@/lib/auth/types";

const ACCESS_TOKEN_TTL_SECONDS = 60 * 15;
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

const FIREBASE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

type AccessTokenPayload = JWTPayload & {
  type: "access";
  email: string | null;
  name: string | null;
  picture: string | null;
  provider: "google";
};

type RefreshTokenPayload = JWTPayload & {
  type: "refresh";
  email: string | null;
  name: string | null;
  picture: string | null;
  provider: "google";
  familyId: string;
  tokenId: string;
};

type SessionStatePayload = JWTPayload & {
  type: "session_state";
  familyId: string;
  currentTokenId: string;
};

function getJwtSecret() {
  const secret = process.env.AUTH_JWT_SECRET;

  if (secret) {
    return secret;
  }

  return "development-auth-secret-change-me";
}

function getJwtSecretBytes() {
  return new TextEncoder().encode(getJwtSecret());
}

function getFirebaseProjectId() {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!projectId) {
    throw new Error("missing_firebase_project_id");
  }

  return projectId;
}

export function getSessionCookieNames() {
  return SESSION_COOKIE_NAMES;
}

export function buildSessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge
  };
}

export function buildClearedCookieOptions() {
  return {
    ...buildSessionCookieOptions(0),
    maxAge: 0
  };
}

export async function verifyFirebaseIdToken(idToken: string): Promise<AuthUser> {
  const projectId = getFirebaseProjectId();
  const { payload } = await jwtVerify(idToken, FIREBASE_JWKS, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId
  });

  const provider = payload.firebase && typeof payload.firebase === "object"
    ? (payload.firebase as Record<string, unknown>).sign_in_provider
    : null;

  if (provider !== "google.com") {
    throw new Error("unsupported_sign_in_provider");
  }

  return {
    uid: String(payload.sub),
    email: typeof payload.email === "string" ? payload.email : null,
    name: typeof payload.name === "string" ? payload.name : null,
    picture: typeof payload.picture === "string" ? payload.picture : null,
    provider: "google"
  };
}

async function signAccessToken(user: AuthUser) {
  return new SignJWT({
    type: "access",
    email: user.email,
    name: user.name,
    picture: user.picture,
    provider: user.provider
  } satisfies Omit<AccessTokenPayload, keyof JWTPayload | "sub">)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.uid)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(getJwtSecretBytes());
}

async function signRefreshToken(user: AuthUser, familyId: string, tokenId: string) {
  return new SignJWT({
    type: "refresh",
    email: user.email,
    name: user.name,
    picture: user.picture,
    provider: user.provider,
    familyId,
    tokenId
  } satisfies Omit<RefreshTokenPayload, keyof JWTPayload | "sub">)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.uid)
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_TOKEN_TTL_SECONDS}s`)
    .sign(getJwtSecretBytes());
}

async function signSessionState(user: AuthUser, familyId: string, currentTokenId: string) {
  return new SignJWT({
    type: "session_state",
    familyId,
    currentTokenId
  } satisfies Omit<SessionStatePayload, keyof JWTPayload | "sub">)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.uid)
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_TOKEN_TTL_SECONDS}s`)
    .sign(getJwtSecretBytes());
}

export async function issueSessionTokens(
  user: AuthUser,
  familyId: string = randomUUID(),
  tokenId: string = randomUUID()
): Promise<SessionTokens> {
  const [accessToken, refreshToken, sessionStateToken] = await Promise.all([
    signAccessToken(user),
    signRefreshToken(user, familyId, tokenId),
    signSessionState(user, familyId, tokenId)
  ]);

  await upsertRefreshFamily(familyId, user.uid, tokenId);

  return {
    accessToken,
    refreshToken,
    sessionStateToken
  };
}

export async function verifyAccessToken(token: string) {
  const { payload } = await jwtVerify(token, getJwtSecretBytes());

  if (payload.type !== "access") {
    throw new Error("invalid_access_token_type");
  }

  return payload as AccessTokenPayload;
}

export async function verifyRefreshToken(token: string) {
  const { payload } = await jwtVerify(token, getJwtSecretBytes());

  if (payload.type !== "refresh") {
    throw new Error("invalid_refresh_token_type");
  }

  return payload as RefreshTokenPayload;
}

export async function verifySessionStateToken(token: string) {
  const { payload } = await jwtVerify(token, getJwtSecretBytes());

  if (payload.type !== "session_state") {
    throw new Error("invalid_session_state_token_type");
  }

  return payload as SessionStatePayload;
}

export function serializeAuthUser(payload: AccessTokenPayload | RefreshTokenPayload) {
  return {
    uid: String(payload.sub),
    email: payload.email ?? null,
    name: payload.name ?? null,
    picture: payload.picture ?? null,
    provider: payload.provider ?? "google"
  } satisfies AuthUser;
}

export async function rotateRefreshSession(
  refreshToken: string,
  sessionStateToken: string
) {
  const refreshPayload = await verifyRefreshToken(refreshToken);
  const statePayload = await verifySessionStateToken(sessionStateToken);

  if (
    refreshPayload.sub !== statePayload.sub ||
    refreshPayload.familyId !== statePayload.familyId ||
    refreshPayload.tokenId !== statePayload.currentTokenId
  ) {
    throw new Error("refresh_token_reuse_detected");
  }

  const family = await getRefreshFamily(refreshPayload.familyId);

  if (!family) {
    await upsertRefreshFamily(
      refreshPayload.familyId,
      String(refreshPayload.sub),
      refreshPayload.tokenId
    );
  } else {
    if (family.revoked) {
      throw new Error("refresh_family_revoked");
    }

    if (
      family.uid !== String(refreshPayload.sub) ||
      family.currentTokenId !== refreshPayload.tokenId
    ) {
      await revokeRefreshFamily(refreshPayload.familyId);
      throw new Error("refresh_token_reuse_detected");
    }
  }

  const user = serializeAuthUser(refreshPayload);
  return issueSessionTokens(user, refreshPayload.familyId, randomUUID());
}

export async function revokeRefreshSessionFamily(sessionStateToken: string) {
  const payload = await verifySessionStateToken(sessionStateToken);
  await revokeRefreshFamily(payload.familyId);
}

export { resetRefreshFamiliesForTests };

export function getAccessTokenTtl() {
  return ACCESS_TOKEN_TTL_SECONDS;
}

export function getRefreshTokenTtl() {
  return REFRESH_TOKEN_TTL_SECONDS;
}
