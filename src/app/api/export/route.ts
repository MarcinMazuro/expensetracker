import { categoryMap, listCategories } from "@/lib/categories";
import { expensesToCsv } from "@/lib/csv";
import { currentMonth, isIsoMonth, monthRange } from "@/lib/dates";
import { listExpenses } from "@/lib/expenses";
import { filterExpenses } from "@/lib/filters";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";

/** CSV of one month (or a whole year with ?year=2026), with the same filters as the list. */
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const params = new URL(request.url).searchParams;
  const year = params.get("year");
  let from: string, to: string, label: string;
  if (year && /^\d{4}$/.test(year)) {
    [from, to, label] = [`${year}-01-01`, `${year}-12-31`, year];
  } else {
    const month = params.get("month");
    label = isIsoMonth(month) ? month : currentMonth();
    ({ from, to } = monthRange(label));
  }

  const [categories, expenses] = await Promise.all([listCategories(user.id), listExpenses(user.id, from, to)]);
  const filtered = filterExpenses(expenses, {
    category: params.get("category") ?? "",
    q: params.get("q") ?? "",
    tag: params.get("tag") ?? "",
  });

  return new Response(expensesToCsv(filtered.reverse(), categoryMap(categories)), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="wydatki-${label}.csv"`,
      "cache-control": "private, no-store",
    },
  });
}
