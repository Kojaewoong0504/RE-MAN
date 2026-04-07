import type { Metadata } from "next";
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
      <body>{children}</body>
    </html>
  );
}
