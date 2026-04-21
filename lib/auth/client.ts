"use client";

import type { AuthUser } from "@/lib/auth/types";
import { clearCreditStatusCache, primeCreditStatusCache } from "@/lib/credits/client";
import type { CreditStatusPayload } from "@/lib/credits/types";

const SESSION_CACHE_TTL_MS = 120_000;
const AUTH_SESSION_EVENT = "reman:auth-session-changed";

type AuthSessionCache = {
  cachedSession: AuthUser | null | undefined;
  cachedSessionAt: number;
  pendingSessionRequest: Promise<AuthUser | null> | null;
};

declare global {
  interface Window {
    __remanAuthSessionCache?: AuthSessionCache;
  }
}

const moduleAuthSessionCache: AuthSessionCache = {
  cachedSession: undefined,
  cachedSessionAt: 0,
  pendingSessionRequest: null
};

function getAuthSessionCache() {
  if (typeof window === "undefined") {
    return moduleAuthSessionCache;
  }

  if (!window.__remanAuthSessionCache) {
    window.__remanAuthSessionCache = {
      cachedSession: undefined,
      cachedSessionAt: 0,
      pendingSessionRequest: null
    };
  }

  return window.__remanAuthSessionCache;
}

function emitAuthSessionChanged(user: AuthUser | null) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(AUTH_SESSION_EVENT, {
      detail: { user }
    })
  );
}

async function jsonOrNull(response: Response) {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function readFreshCachedSession() {
  const cache = getAuthSessionCache();

  if (cache.cachedSession === undefined) {
    return undefined;
  }

  if (Date.now() - cache.cachedSessionAt > SESSION_CACHE_TTL_MS) {
    return undefined;
  }

  return cache.cachedSession;
}

function writeCachedSession(user: AuthUser | null) {
  const cache = getAuthSessionCache();
  const previousUserId = cache.cachedSession?.uid ?? null;

  cache.cachedSession = user;
  cache.cachedSessionAt = Date.now();

  if (previousUserId !== (user?.uid ?? null)) {
    emitAuthSessionChanged(user);
  }

  return user;
}

export function primeAuthSessionCache(user: AuthUser | null | undefined) {
  if (user === undefined) {
    return undefined;
  }

  return writeCachedSession(user);
}

export function clearAuthSessionCache() {
  const cache = getAuthSessionCache();

  cache.cachedSession = undefined;
  cache.cachedSessionAt = 0;
  cache.pendingSessionRequest = null;
  clearCreditStatusCache();
  emitAuthSessionChanged(null);
}

export function readCachedAuthSessionSnapshot() {
  const cache = getAuthSessionCache();
  return cache.cachedSession;
}

export function subscribeAuthSessionChange(listener: (user: AuthUser | null) => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<{ user: AuthUser | null }>;
    listener(customEvent.detail.user);
  };

  window.addEventListener(AUTH_SESSION_EVENT, handler);

  return () => {
    window.removeEventListener(AUTH_SESSION_EVENT, handler);
  };
}

type AuthBootstrapResponse = {
  user?: AuthUser | null;
  credits?: CreditStatusPayload;
};

type FetchAuthSessionOptions = {
  includeCredits?: boolean;
};

async function requestAuthSession(
  options: FetchAuthSessionOptions = {}
): Promise<AuthUser | null> {
  const url = options.includeCredits
    ? "/api/auth/bootstrap?include=credits"
    : "/api/auth/bootstrap";
  const sessionResponse = await fetch(url, {
    method: "GET",
    credentials: "include",
    cache: "no-store"
  });

  if (sessionResponse.ok) {
    const sessionJson = (await jsonOrNull(sessionResponse)) as AuthBootstrapResponse | null;

    if (sessionJson?.credits) {
      primeCreditStatusCache(sessionJson.credits);
    }

    return writeCachedSession((sessionJson?.user as AuthUser | undefined) ?? null);
  }

  clearCreditStatusCache();
  return writeCachedSession(null);
}

export async function fetchAuthSession(
  options: FetchAuthSessionOptions = {}
): Promise<AuthUser | null> {
  const cache = getAuthSessionCache();
  const cached = readFreshCachedSession();

  if (cached !== undefined) {
    return cached;
  }

  if (cache.pendingSessionRequest) {
    return cache.pendingSessionRequest;
  }

  cache.pendingSessionRequest = requestAuthSession(options).finally(() => {
    cache.pendingSessionRequest = null;
  });

  return cache.pendingSessionRequest;
}

export async function createServerSession(idToken: string) {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ idToken })
  });

  if (!response.ok) {
    const body = await jsonOrNull(response);
    clearAuthSessionCache();
    throw new Error(typeof body?.error === "string" ? body.error : "server_login_failed");
  }

  const body = await jsonOrNull(response);
  return writeCachedSession((body?.user as AuthUser | undefined) ?? null);
}

export async function createDevServerSession() {
  const response = await fetch("/api/auth/dev-login", {
    method: "POST",
    credentials: "include"
  });

  if (!response.ok) {
    const body = await jsonOrNull(response);
    clearAuthSessionCache();
    throw new Error(typeof body?.error === "string" ? body.error : "dev_login_failed");
  }

  const body = await jsonOrNull(response);
  return writeCachedSession((body?.user as AuthUser | undefined) ?? null);
}

export async function destroyServerSession() {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include"
  });
  clearAuthSessionCache();
}
