/** Colour themes, chosen per device. "auto" follows the system setting. */
export const THEMES = {
  auto: { name: "Automatyczny", canvas: "#f3f6f2", surface: "#131a18", accent: "#0f766e", bar: "#0b100f" },
  light: { name: "Jasny", canvas: "#f3f6f2", surface: "#ffffff", accent: "#0f766e", bar: "#f3f6f2" },
  dark: { name: "Ciemny", canvas: "#0b100f", surface: "#131a18", accent: "#2dd4bf", bar: "#0b100f" },
  hearts: { name: "Serduszka", canvas: "#ffe9f0", surface: "#ffffff", accent: "#e11d48", bar: "#ffe9f0" },
  christmas: { name: "Święta", canvas: "#0a1d15", surface: "#10291d", accent: "#f0484e", bar: "#0a1d15" },
} as const;

export type Theme = keyof typeof THEMES;
export const THEME_COOKIE = "et_theme";

export function toTheme(value: unknown): Theme {
  return typeof value === "string" && Object.hasOwn(THEMES, value) ? (value as Theme) : "auto";
}
