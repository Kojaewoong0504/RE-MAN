"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CreditStatus } from "@/components/credits/CreditStatus";
import {
  fetchAuthSession,
  readCachedAuthSessionSnapshot,
  subscribeAuthSessionChange
} from "@/lib/auth/client";
import type { AuthUser } from "@/lib/auth/types";

type AccountAccessButtonProps = {
  hideWhenSignedOut?: boolean;
  showProfileLink?: boolean;
};

export function AccountAccessButton({
  hideWhenSignedOut = false,
  showProfileLink = true
}: AccountAccessButtonProps) {
  const cachedUser = readCachedAuthSessionSnapshot();
  const [href, setHref] = useState(cachedUser ? "/profile" : "/login");
  const [label, setLabel] = useState(
    cachedUser ? (cachedUser.name ?? cachedUser.email ?? "R").slice(0, 1) : "Login"
  );
  const [user, setUser] = useState<AuthUser | null | undefined>(cachedUser);

  useEffect(() => {
    let active = true;

    function applyUser(user: AuthUser | null) {
      if (!active) {
        return;
      }

      setUser(user);

      if (user) {
        setHref("/profile");
        setLabel((user.name ?? user.email ?? "R").slice(0, 1));
        return;
      }

      setHref("/login");
      setLabel("Login");
    }

    async function load() {
      const cachedUser = readCachedAuthSessionSnapshot();

      if (cachedUser !== undefined) {
        applyUser(cachedUser);
        return;
      }

      applyUser(await fetchAuthSession({ includeCredits: true }));
    }

    void load();
    const unsubscribe = subscribeAuthSessionChange(applyUser);

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  if (hideWhenSignedOut && !user) {
    return null;
  }

  return (
    <div className="app-header-actions">
      <CreditStatus variant="badge" />
      {showProfileLink ? (
        <Link
          className="account-access-pill"
          href={href}
        >
          {label}
        </Link>
      ) : null}
    </div>
  );
}
