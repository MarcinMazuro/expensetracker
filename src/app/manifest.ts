import type { MetadataRoute } from "next";

/** Installable on a phone home screen; opens straight into the app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wydatki",
    short_name: "Wydatki",
    description: "Wydatki, budżety i paragony czytane przez AI",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f5f1",
    theme_color: "#0f766e",
    lang: "pl",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
    shortcuts: [
      { name: "Skanuj paragon", url: "/scan" },
      { name: "Dodaj wydatek", url: "/expenses/new" },
    ],
  };
}
