"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

type FirebaseClientConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

let authEmulatorConnected = false;
let firestoreEmulatorConnected = false;

function getFirebaseClientConfig(): FirebaseClientConfig | null {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

  if (
    !apiKey ||
    !authDomain ||
    !projectId ||
    !storageBucket ||
    !messagingSenderId ||
    !appId
  ) {
    return null;
  }

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId
  };
}

export function hasFirebaseClientConfig() {
  return getFirebaseClientConfig() !== null;
}

export function isFirebaseEmulatorEnabled() {
  return process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATOR === "true";
}

export function getFirebaseConnectionMode() {
  return isFirebaseEmulatorEnabled() ? "emulator" : "project";
}

export function getFirebaseAppInstance(): FirebaseApp | null {
  const config = getFirebaseClientConfig();

  if (!config) {
    return null;
  }

  if (getApps().length > 0) {
    return getApp();
  }

  return initializeApp(config);
}

export function getFirebaseAuthInstance() {
  const app = getFirebaseAppInstance();

  if (!app) {
    return null;
  }

  const auth = getAuth(app);

  if (isFirebaseEmulatorEnabled() && !authEmulatorConnected) {
    connectAuthEmulator(
      auth,
      `http://${process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099"}`,
      { disableWarnings: true }
    );
    authEmulatorConnected = true;
  }

  return auth;
}

export function getFirebaseFirestoreInstance() {
  const app = getFirebaseAppInstance();

  if (!app) {
    return null;
  }

  const firestore = getFirestore(app);

  if (isFirebaseEmulatorEnabled() && !firestoreEmulatorConnected) {
    const host = process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST ?? "127.0.0.1";
    const port = Number(process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_PORT ?? "8080");
    connectFirestoreEmulator(firestore, host, port);
    firestoreEmulatorConnected = true;
  }

  return firestore;
}
