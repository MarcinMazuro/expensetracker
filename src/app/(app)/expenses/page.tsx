import type { Metadata } from "next";
import Link from "next/link";
import { ExpenseRow } from "@/components/ExpenseRow";
import { PersonSwitcher } from "@/components/PersonSwitcher";
import { MonthSwitcher } from "@/components/MonthSwitcher";
import { Card, EmptyState, inputClass, LinkButton, buttonClass } from "@/components/ui";
import { categoryMap, listCategories, UNKNOWN_CATEGORY } from "@/lib/categories";
import { currentMonth, formatDay, isIsoMonth, monthRange } from "@/lib/dates";
import { listVisibleExpenses } from "@/lib/expenses";
import { filterExpenses, groupByDay } from "@/lib/filters";
import { formatMoney } from "@/lib/money";
import { bookDueRecurring } from "@/lib/recurring";
import { resolveOwner } from "@/lib/people";
import { requireUser } from "@/lib/session";
import { total } from "@/lib/stats";
import { plural } from "@/lib/text";

export const metadata: Metadata = { title: "Wydatki" };

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function ExpensesPage({ searchParams }: PageProps<"/expenses">) {
  const user = await requireUser();
  const params = await searchParams;
  const month = isIsoMonth(params.month) ? params.month : currentMonth();
  const filters = { category: str(params.category), q: str(params.q).slice(0, 100), tag: str(params.tag) };

  const { owner, people } = await resolveOwner(user, params.u);
  const mine = owner.id === user.id;

  await bookDueRecurring(owner.id);
  const { from, to } = monthRange(month);
  const [categories, all] = await Promise.all([listCategories(owner.id), listVisibleExpenses(user.id, owner.id, from, to)]);
  const categoriesById = categoryMap(categories);
  const expenses = filterExpenses(all, filters);
  const days = groupByDay(expenses);
  const filtered = Boolean(filters.category || filters.q || filters.tag);
  const activeParams = Object.fromEntries(Object.entries({ ...filters, u: mine ? "" : owner.id }).filter(([, v]) => v));
  const exportQuery = new URLSearchParams({ month, ...activeParams });

  return (
    <>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Wydatki</h1>
          <PersonSwitcher people={people} owner={owner} viewer={user} path="/expenses" params={{ month, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) }} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MonthSwitcher month={month} path="/expenses" params={activeParams} />
          <a href={`/api/export?${exportQuery}`} className={buttonClass("secondary")} download>CSV</a>
          {mine && <LinkButton href="/expenses/new">+ Dodaj</LinkButton>}
        </div>
      </header>

      <form className="mb-4 grid gap-2 sm:grid-cols-[1fr_14rem_auto]" role="search">
        <input type="hidden" name="month" value={month} />
        {!mine && <input type="hidden" name="u" value={owner.id} />}
        <input name="q" defaultValue={filters.q} placeholder="Szukaj: sklep, notatka, produkt z paragonu, #tag" className={inputClass} />
        <select name="category" defaultValue={filters.category} className={inputClass}>
          <option value="">Wszystkie kategorie</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
        </select>
        <button className={buttonClass("secondary")}>Filtruj</button>
      </form>

      {filters.tag && (
        <p className="mb-4 text-sm">
          Tag <strong>#{filters.tag}</strong> ·{" "}
          <Link href={`/expenses?${new URLSearchParams({ month, ...(filters.q && { q: filters.q }), ...(filters.category && { category: filters.category }), ...(!mine && { u: owner.id }) })}`} className="text-accent hover:underline">usuń</Link>
        </p>
      )}

      <Card className="mb-4 flex flex-wrap items-center justify-between gap-2 py-4">
        <span className="text-sm text-fg-muted">
          {filtered ? `${expenses.length} z ${plural(all.length, "wydatku", "wydatków", "wydatków")}` : plural(expenses.length, "wydatek", "wydatki", "wydatków")}
          {filtered && <> · <Link href={`/expenses?month=${month}${mine ? "" : `&u=${owner.id}`}`} className="text-accent hover:underline">wyczyść filtry</Link></>}
        </span>
        <span className="text-lg font-semibold tabular">{formatMoney(total(expenses))}</span>
      </Card>

      {days.length === 0 ? (
        <EmptyState title={filtered ? "Nic nie pasuje do filtrów" : "Brak wydatków w tym miesiącu"}>
          {!filtered && <Link href="/scan" className="text-accent hover:underline">Zeskanuj paragon</Link>}
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {days.map((day) => (
            <Card key={day.date} className="px-3 py-3">
              <div className="mb-1 flex items-baseline justify-between px-2 text-sm">
                <h2 className="font-medium first-letter:uppercase">{formatDay(day.date)}</h2>
                <span className="text-fg-muted tabular">{formatMoney(day.total)}</span>
              </div>
              {day.expenses.map((e) => (
                <ExpenseRow key={e.id} expense={e} category={categoriesById.get(e.categoryId) ?? UNKNOWN_CATEGORY} people={people} ownerId={mine ? undefined : owner.id} />
              ))}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
