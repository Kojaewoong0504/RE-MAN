"use client";

import type { AuthUser } from "@/lib/auth/types";

async function jsonOrNull(response: Response) {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function fetchAuthSession(): Promise<AuthUser | null> {
  const sessionResponse = await fetch("/api/auth/session", {
    method: "GET",
    credentials: "include",
    cache: "no-store"
  });

  if (sessionResponse.ok) {
    const sessionJson = await jsonOrNull(sessionResponse);
    return (sessionJson?.user as AuthUser | undefined) ?? null;
  }

  const refreshResponse = await fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "include"
  });

  if (!refreshResponse.ok) {
    return null;
  }

  const retryResponse = await fetch("/api/auth/session", {
    method: "GET",
    credentials: "include",
    cache: "no-store"
  });

  if (!retryResponse.ok) {
    return null;
  }

  const retryJson = await jsonOrNull(retryResponse);
  return (retryJson?.user as AuthUser | undefined) ?? null;
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
    throw new Error(typeof body?.error === "string" ? body.error : "server_login_failed");
  }

  const body = await jsonOrNull(response);
  return (body?.user as AuthUser | undefined) ?? null;
}

export async function destroyServerSession() {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include"
  });
}
