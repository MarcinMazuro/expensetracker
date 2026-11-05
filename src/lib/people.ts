import "server-only";
import type { User } from "./types";
import { activeUsers } from "./users";

/**
 * Whose data a page or action works on. Everyone in the household has full
 * access to everyone else's expenses (the people agreed to it), so any
 * active account may be chosen; anything else falls back to the viewer.
 */
export async function resolveOwner(viewer: User, requested: unknown): Promise<{ owner: User; people: User[] }> {
  const people = (await activeUsers()).sort((a, b) => (a.id === viewer.id ? -1 : b.id === viewer.id ? 1 : 0));
  const owner = (typeof requested === "string" && people.find((p) => p.id === requested)) || viewer;
  return { owner, people };
}

/** "?u=<id>" for links to another person's data, nothing for your own. */
export function ownerQuery(viewer: Pick<User, "id">, owner: Pick<User, "id">, prefix: "?" | "&" = "?"): string {
  return owner.id === viewer.id ? "" : `${prefix}u=${owner.id}`;
}
