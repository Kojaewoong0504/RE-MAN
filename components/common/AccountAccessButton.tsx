"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CreditStatus } from "@/components/credits/CreditStatus";
import { fetchAuthSession, subscribeAuthSessionChange } from "@/lib/auth/client";
import type { AuthUser } from "@/lib/auth/types";

export function AccountAccessButton() {
  const [href, setHref] = useState("/login");
  const [label, setLabel] = useState("Login");

  useEffect(() => {
    let active = true;

    function applyUser(user: AuthUser | null) {
      if (!active) {
        return;
      }

      if (user) {
        setHref("/profile");
        setLabel("Me");
        return;
      }

      setHref("/login");
      setLabel("Login");
    }

    async function load() {
      applyUser(await fetchAuthSession());
    }

    void load();
    const unsubscribe = subscribeAuthSessionChange(applyUser);

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return (
    <div className="app-header-actions">
      <CreditStatus variant="badge" />
      <Link
        className="flex h-8 min-w-8 items-center justify-center rounded-full border border-black/15 bg-[#fffaf0] px-3 text-[11px] font-black uppercase tracking-[0.12em] text-ink transition active:translate-y-px"
        href={href}
      >
        {label}
      </Link>
    </div>
  );
}
