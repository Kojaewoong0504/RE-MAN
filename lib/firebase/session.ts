"use client";

import {
  browserLocalPersistence,
  GoogleAuthProvider,
  linkWithPopup,
  setPersistence,
  signInWithPopup,
  signInAnonymously
} from "firebase/auth";
import { getFirebaseAuthInstance, hasFirebaseClientConfig } from "@/lib/firebase/client";

let bootPromise: Promise<string | null> | null = null;

export function ensureAnonymousSession() {
  if (!hasFirebaseClientConfig()) {
    return Promise.resolve<string | null>(null);
  }

  if (bootPromise) {
    return bootPromise;
  }

  bootPromise = (async () => {
    const auth = getFirebaseAuthInstance();

    if (!auth) {
      return null;
    }

    await setPersistence(auth, browserLocalPersistence);

    if (auth.currentUser?.uid) {
      return auth.currentUser.uid;
    }

    const credential = await signInAnonymously(auth);
    return credential.user.uid;
  })();

  return bootPromise;
}

export async function upgradeAnonymousSessionToGoogle() {
  if (!hasFirebaseClientConfig()) {
    throw new Error("missing_firebase_client_config");
  }

  const auth = getFirebaseAuthInstance();

  if (!auth) {
    throw new Error("missing_firebase_auth");
  }

  await setPersistence(auth, browserLocalPersistence);

  const provider = new GoogleAuthProvider();
  const currentUser = auth.currentUser;

  if (currentUser?.isAnonymous) {
    const credential = await linkWithPopup(currentUser, provider);
    return {
      uid: credential.user.uid,
      email: credential.user.email ?? null,
      linked: true
    };
  }

  const credential = await signInWithPopup(auth, provider);

  return {
    uid: credential.user.uid,
    email: credential.user.email ?? null,
    linked: false
  };
}
