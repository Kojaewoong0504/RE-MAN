"use client";

import {
  browserLocalPersistence,
  GoogleAuthProvider,
  signOut,
  setPersistence,
  signInWithPopup
} from "firebase/auth";
import { getFirebaseAuthInstance, hasFirebaseClientConfig } from "@/lib/firebase/client";

export async function signInWithGoogleSession() {
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

  const provider = new GoogleAuthProvider();
  const credential = await signInWithPopup(auth, provider);
  const idToken = await credential.user.getIdToken();

  return {
    uid: credential.user.uid,
    email: credential.user.email ?? null,
    displayName: credential.user.displayName ?? null,
    photoURL: credential.user.photoURL ?? null,
    idToken
  };
}

export async function signOutFirebaseSession() {
  const auth = getFirebaseAuthInstance();

  if (!auth) {
    return;
  }

  await signOut(auth);
}
