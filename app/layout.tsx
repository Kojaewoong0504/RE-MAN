import type { Metadata } from "next";
import { BottomTabNav } from "@/components/common/BottomTabNav";
import { FirebaseSessionBootstrap } from "@/components/common/FirebaseSessionBootstrap";
import { SessionCacheHydrator } from "@/components/common/SessionCacheHydrator";
import { getOptionalSessionUser } from "@/lib/auth/session-user";
import { getCreditBalanceAsync } from "@/lib/credits/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "RE:MAN",
  description: "Judgment-free AI style coaching built around a one-week transformation."
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialUser = await getOptionalSessionUser();
  const initialCredits = initialUser ? await getCreditBalanceAsync(initialUser.uid) : null;

  return (
    <html lang="ko">
      <body>
        <SessionCacheHydrator initialCredits={initialCredits} initialUser={initialUser} />
        <FirebaseSessionBootstrap />
        {children}
        <BottomTabNav />
      </body>
    </html>
  );
}
