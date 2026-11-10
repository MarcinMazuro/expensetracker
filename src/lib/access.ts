/**
 * Who may sign in. The lists come from Terraform (ALLOWED_EMAILS,
 * ADMIN_EMAILS), so granting access is a reviewed infrastructure change,
 * not a button in the app.
 */
export function parseEmailList(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(/[,\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes("@")),
  );
}

export function allowedEmails(): Set<string> {
  return parseEmailList(process.env.ALLOWED_EMAILS);
}

export function isAllowed(email: string): boolean {
  return allowedEmails().has(email.trim().toLowerCase());
}

export function isAdminEmail(email: string): boolean {
  return parseEmailList(process.env.ADMIN_EMAILS).has(email.trim().toLowerCase());
}

/**
 * Local "sign in as..." buttons for previewing seeded demo data. Needs an
 * explicit flag AND the development database, and never runs on Cloud Run
 * (which always sets K_SERVICE) - three independent locks.
 */
export function devLoginEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.DEV_LOGIN === "true" && env.FIRESTORE_DATABASE === "development" && !env.K_SERVICE;
}

/** Each person gets a colour in shared views, assigned in sign-up order. */
export const PERSON_COLORS = ["#0d9488", "#e11d48", "#7c3aed", "#d97706", "#2563eb"];

/** Avatars to choose from: a head for small sizes, a full cut-out for large ones, and the species behind them. */
export const AVATARS = {
  lion: { name: "Lew", head: "/avatars/lion.webp", full: "/avatars/lion-full.webp", species: "lion" },
  lion2: { name: "Lew z grzywą", head: "/animals/lion-portrait-head.webp", full: "/animals/lion-portrait.webp", species: "lion" },
  puma: { name: "Puma", head: "/avatars/puma.webp", full: "/avatars/puma-full.webp", species: "puma" },
  puma2: { name: "Puma z bliska", head: "/animals/puma-portrait-head.webp", full: "/animals/puma-portrait.webp", species: "puma" },
} as const;

export type AvatarId = keyof typeof AVATARS;

export function isAvatarId(value: unknown): value is AvatarId {
  return typeof value === "string" && value in AVATARS;
}

/** Default avatars from Terraform: "a@gmail.com=lion,b@gmail.com=puma". */
export function defaultAvatar(email: string, value = process.env.DEFAULT_AVATARS): AvatarId | undefined {
  for (const pair of (value ?? "").split(",")) {
    const [address, avatar] = pair.split("=").map((s) => s.trim().toLowerCase());
    if (address === email.trim().toLowerCase() && isAvatarId(avatar)) return avatar;
  }
  return undefined;
}

/** Which big cat a person is, from the avatar they chose. */
export function speciesOf(avatar: string | undefined): "lion" | "puma" | undefined {
  return isAvatarId(avatar) ? AVATARS[avatar].species : undefined;
}
