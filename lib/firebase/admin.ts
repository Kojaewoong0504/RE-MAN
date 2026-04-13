import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function getFirebaseAdminProjectId() {
  return process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
}

function getFirebaseAdminClientEmail() {
  return process.env.FIREBASE_CLIENT_EMAIL;
}

function getFirebaseAdminPrivateKey() {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!privateKey) {
    return null;
  }

  return privateKey.replace(/\\n/g, "\n");
}

export function hasFirebaseAdminConfig() {
  return Boolean(
    getFirebaseAdminProjectId() &&
      getFirebaseAdminClientEmail() &&
      getFirebaseAdminPrivateKey()
  );
}

export function getFirebaseAdminApp() {
  if (!hasFirebaseAdminConfig()) {
    return null;
  }

  if (getApps().length > 0) {
    return getApp();
  }

  return initializeApp({
    credential: cert({
      projectId: getFirebaseAdminProjectId(),
      clientEmail: getFirebaseAdminClientEmail(),
      privateKey: getFirebaseAdminPrivateKey() ?? undefined
    })
  });
}

export function getFirebaseAdminFirestore() {
  const app = getFirebaseAdminApp();

  if (!app) {
    return null;
  }

  return getFirestore(app);
}
