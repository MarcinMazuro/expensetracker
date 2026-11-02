import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// latin-ext is required for Polish diacritics
const geist = Geist({ variable: "--font-geist", subsets: ["latin", "latin-ext"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin", "latin-ext"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "ExpenseTracker", template: "%s · ExpenseTracker" },
  description: "Wydatki, budżety i paragony czytane przez AI",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Wydatki", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f1" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0f0f" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" className={`${geist.variable} ${geistMono.variable}`}>
      <body className="min-h-svh">{children}</body>
    </html>
  );
}
