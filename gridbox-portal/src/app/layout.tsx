import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Gridbox Dashboard",
  description: "Gridbox portal dashboard",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl" style={{ overflowX: "hidden" }}>
      <body className={inter.className} style={{ overflowX: "hidden" }}>{children}</body>
    </html>
  );
}
