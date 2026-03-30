import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gridbox Dashboard",
  description: "Gridbox portal dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}