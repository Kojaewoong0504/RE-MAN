import type { Metadata } from "next";
import { BottomTabNav } from "@/components/common/BottomTabNav";
import { FirebaseSessionBootstrap } from "@/components/common/FirebaseSessionBootstrap";
import "./globals.css";

export const metadata: Metadata = {
  title: "RE:MAN",
  description: "Judgment-free AI style coaching built around a one-week transformation."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <FirebaseSessionBootstrap />
        {children}
        <BottomTabNav />
      </body>
    </html>
  );
}
