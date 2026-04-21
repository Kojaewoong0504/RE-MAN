"use client";

import { useLayoutEffect } from "react";
import type { AuthUser } from "@/lib/auth/types";
import { primeAuthSessionCache } from "@/lib/auth/client";
import { primeCreditStatusCache } from "@/lib/credits/client";
import type { CreditStatusPayload } from "@/lib/credits/types";

type SessionCacheHydratorProps = {
  initialUser: AuthUser | null;
  initialCredits: CreditStatusPayload | null;
};

export function SessionCacheHydrator({
  initialUser,
  initialCredits
}: SessionCacheHydratorProps) {
  useLayoutEffect(() => {
    primeAuthSessionCache(initialUser);
    primeCreditStatusCache(initialCredits);
  }, [initialCredits, initialUser]);

  return null;
}
