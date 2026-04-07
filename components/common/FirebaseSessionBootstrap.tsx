"use client";

import { useEffect } from "react";
import { ensureAnonymousSession } from "@/lib/firebase/session";
import { patchOnboardingState, readOnboardingState } from "@/lib/onboarding/storage";

export function FirebaseSessionBootstrap() {
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const uid = await ensureAnonymousSession();

      if (!uid || cancelled) {
        return;
      }

      const state = readOnboardingState();

      if (state.user_id === uid) {
        return;
      }

      patchOnboardingState({ user_id: uid });
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
