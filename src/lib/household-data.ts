import "server-only";
import { listCategories } from "./categories";
import { listVisibleExpenses } from "./expenses";
import type { Member } from "./household";
import { listUsers } from "./users";

/**
 * Everyone's expenses in the date range, as the viewer may see them. Every
 * active account belongs to the one household - the app is only for the
 * people on the allowlist. Hidden expenses of others stay out of every total.
 */
export async function loadHousehold(viewerId: string, from: string, to: string): Promise<Member[]> {
  const users = (await listUsers()).filter((u) => !u.disabled);
  return Promise.all(
    users.map(async (user) => {
      const [expenses, categories] = await Promise.all([listVisibleExpenses(viewerId, user.id, from, to), listCategories(user.id)]);
      return { user, expenses, categories };
    }),
  );
}
