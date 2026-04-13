"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchAuthSession } from "@/lib/auth/client";

export function AccountAccessButton() {
  const [href, setHref] = useState("/login");
  const [label, setLabel] = useState("Login");

  useEffect(() => {
    let active = true;

    async function load() {
      const user = await fetchAuthSession();

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

    void load();

    return () => {
      active = false;
    };
  }, []);

  return (
    <Link
      className="flex h-8 min-w-8 items-center justify-center rounded-full border border-black bg-[#f1eadb] px-3 text-[11px] font-black uppercase tracking-[0.12em]"
      href={href}
    >
      {label}
    </Link>
  );
}
