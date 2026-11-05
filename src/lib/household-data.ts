import "server-only";
import { listCategories } from "./categories";
import { listExpenses } from "./expenses";
import type { Member } from "./household";
import { listUsers } from "./users";

/**
 * Everyone's expenses in the date range. Every active account belongs to
 * the one household - the app is only for the people on the allowlist.
 */
export async function loadHousehold(from: string, to: string): Promise<Member[]> {
  const users = (await listUsers()).filter((u) => !u.disabled);
  return Promise.all(
    users.map(async (user) => {
      const [expenses, categories] = await Promise.all([listExpenses(user.id, from, to), listCategories(user.id)]);
      return { user, expenses, categories };
    }),
  );
}
