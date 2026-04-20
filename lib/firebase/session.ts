"use client";

import {
  browserLocalPersistence,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  type UserCredential
} from "firebase/auth";
import { getFirebaseAuthInstance, hasFirebaseClientConfig } from "@/lib/firebase/client";

export type AuthenticatedGoogleSession = {
  status: "authenticated";
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  idToken: string;
};

export type GoogleSessionResult =
  | AuthenticatedGoogleSession
  | {
      status: "redirecting";
    };

function isPopupBlockedError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as { code?: unknown; message?: unknown };
  const code = typeof record.code === "string" ? record.code : "";
  const message = typeof record.message === "string" ? record.message : "";

  return code === "auth/popup-blocked" || message.includes("auth/popup-blocked");
}

function createGoogleProvider() {
  return new GoogleAuthProvider();
}

async function prepareGoogleAuth() {
  if (!hasFirebaseClientConfig()) {
    throw new Error("missing_firebase_client_config");
  }

  const auth = getFirebaseAuthInstance();

  if (!auth) {
    throw new Error("missing_firebase_auth");
  }

  await setPersistence(auth, browserLocalPersistence);
  if (typeof auth.authStateReady === "function") {
    await auth.authStateReady();
  }

  return auth;
}

async function normalizeCredential(credential: UserCredential): Promise<AuthenticatedGoogleSession> {
  const idToken = await credential.user.getIdToken();

  return {
    status: "authenticated",
    uid: credential.user.uid,
    email: credential.user.email ?? null,
    displayName: credential.user.displayName ?? null,
    photoURL: credential.user.photoURL ?? null,
    idToken
  };
}

export async function completeGoogleRedirectSession() {
  const auth = await prepareGoogleAuth();
  const credential = await getRedirectResult(auth);

  if (!credential) {
    return null;
  }

  return normalizeCredential(credential);
}

export async function signInWithGoogleSession(): Promise<GoogleSessionResult> {
  const auth = await prepareGoogleAuth();
  const provider = createGoogleProvider();

  try {
    const credential = await signInWithPopup(auth, provider);
    return normalizeCredential(credential);
  } catch (error) {
    if (!isPopupBlockedError(error)) {
      throw error;
    }

    await signInWithRedirect(auth, provider);
    return { status: "redirecting" };
  }
}

export async function signOutFirebaseSession() {
  const auth = getFirebaseAuthInstance();

  if (!auth) {
    return;
  }

  await signOut(auth);
}
