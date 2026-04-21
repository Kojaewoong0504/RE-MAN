"use client";

import { useEffect } from "react";
import {
  createServerSession,
  fetchAuthSession,
  readCachedAuthSessionSnapshot
} from "@/lib/auth/client";
import { getFirebaseAuthInstance } from "@/lib/firebase/client";
import { readStyleProgramStateFromFirestore } from "@/lib/firebase/firestore";
import {
  mergePersistedProgramState,
  patchOnboardingState,
  readOnboardingState,
  writeOnboardingState
} from "@/lib/onboarding/storage";

export function FirebaseSessionBootstrap() {
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const auth = getFirebaseAuthInstance();

      if (!auth) {
        return;
      }

      if (typeof auth.authStateReady === "function") {
        await auth.authStateReady();
      }

      if (cancelled) {
        return;
      }

      const currentUser = auth?.currentUser ?? null;

      if (!currentUser) {
        return;
      }

      const state = readOnboardingState();

      const cachedSession = readCachedAuthSessionSnapshot();
      const existingSession =
        cachedSession === undefined
          ? await fetchAuthSession({ includeCredits: true })
          : cachedSession;

      if (!existingSession) {
        try {
          const idToken = await currentUser.getIdToken();
          await createServerSession(idToken);
        } catch {
          return;
        }
      }

      const syncedState = patchOnboardingState({
        user_id: currentUser.uid,
        email: currentUser.email ?? undefined
      });

      try {
        const persisted = await readStyleProgramStateFromFirestore(currentUser.uid);

        if (!cancelled && persisted) {
          writeOnboardingState(mergePersistedProgramState(syncedState, persisted));
        }
      } catch {
        return;
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
