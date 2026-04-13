type RefreshFamilyState = {
  uid: string;
  currentTokenId: string;
  revoked: boolean;
};

import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminFirestore, hasFirebaseAdminConfig } from "@/lib/firebase/admin";

declare global {
  // eslint-disable-next-line no-var
  var __remanRefreshFamilies: Map<string, RefreshFamilyState> | undefined;
}

function getRefreshFamilies() {
  if (!globalThis.__remanRefreshFamilies) {
    globalThis.__remanRefreshFamilies = new Map<string, RefreshFamilyState>();
  }

  return globalThis.__remanRefreshFamilies;
}

function getRefreshFamilyDocRef(familyId: string) {
  const db = getFirebaseAdminFirestore();

  if (!db) {
    return null;
  }

  return db.collection("auth_refresh_families").doc(familyId);
}

export async function upsertRefreshFamily(
  familyId: string,
  uid: string,
  currentTokenId: string,
  revoked: boolean = false
) {
  if (hasFirebaseAdminConfig()) {
    const docRef = getRefreshFamilyDocRef(familyId);

    if (docRef) {
      await docRef.set(
        {
          uid,
          currentTokenId,
          revoked,
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );
      return;
    }
  }

  getRefreshFamilies().set(familyId, {
    uid,
    currentTokenId,
    revoked
  });
}

export async function getRefreshFamily(familyId: string) {
  if (hasFirebaseAdminConfig()) {
    const docRef = getRefreshFamilyDocRef(familyId);

    if (docRef) {
      const snapshot = await docRef.get();

      if (!snapshot.exists) {
        return null;
      }

      return snapshot.data() as RefreshFamilyState;
    }
  }

  return getRefreshFamilies().get(familyId) ?? null;
}

export async function revokeRefreshFamily(familyId: string) {
  const existing = await getRefreshFamily(familyId);

  if (!existing) {
    return;
  }

  await upsertRefreshFamily(familyId, existing.uid, existing.currentTokenId, true);
}

export async function resetRefreshFamiliesForTests() {
  if (hasFirebaseAdminConfig()) {
    const db = getFirebaseAdminFirestore();

    if (db) {
      const snapshot = await db.collection("auth_refresh_families").get();
      const batch = db.batch();
      snapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
  }

  getRefreshFamilies().clear();
}
