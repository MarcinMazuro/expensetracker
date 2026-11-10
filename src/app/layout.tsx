import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { Ambient } from "@/components/Ambient";
import { THEME_COOKIE, THEMES, toTheme } from "@/lib/theme";
import "./globals.css";

// latin-ext is required for Polish diacritics
const geist = Geist({ variable: "--font-geist", subsets: ["latin", "latin-ext"], display: "swap" });
// Headings and big amounts - a grotesque with some character
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin", "latin-ext"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin", "latin-ext"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Wydatki", template: "%s · Wydatki" },
  description: "Wydatki, budżety i paragony czytane przez AI",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Wydatki", statusBarStyle: "default" },
};

async function currentTheme() {
  return toTheme((await cookies()).get(THEME_COOKIE)?.value);
}

export async function generateViewport(): Promise<Viewport> {
  const theme = await currentTheme();
  if (theme !== "auto") return { themeColor: THEMES[theme].bar };
  return {
    themeColor: [
      { media: "(prefers-color-scheme: light)", color: THEMES.light.bar },
      { media: "(prefers-color-scheme: dark)", color: THEMES.dark.bar },
    ],
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = await currentTheme();
  return (
    <html lang="pl" className={`${geist.variable} ${geistMono.variable} ${bricolage.variable}`} data-theme={theme === "auto" ? undefined : theme}>
      <body className="min-h-svh">
        <Ambient theme={theme} />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
