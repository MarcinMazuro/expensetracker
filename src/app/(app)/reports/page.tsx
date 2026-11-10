import type { Metadata } from "next";
import Link from "next/link";
import { PersonSwitcher } from "@/components/PersonSwitcher";
import { BarChart } from "@/components/charts/BarChart";
import { Card, CardTitle, CategoryDot, buttonClass } from "@/components/ui";
import { categoryMap, listCategories, UNKNOWN_CATEGORY } from "@/lib/categories";
import { currentMonth, formatMonth, formatMonthShort, monthRange, monthsBack } from "@/lib/dates";
import { listVisibleExpenses } from "@/lib/expenses";
import { formatMoney, formatMoneyShort } from "@/lib/money";
import { resolveOwner } from "@/lib/people";
import { requireUser } from "@/lib/session";
import { byCategory, byWeekday, categoryByMonth, monthlyTotals, total } from "@/lib/stats";

export const metadata: Metadata = { title: "Raporty" };

const WEEKDAYS = ["pon", "wt", "śr", "czw", "pt", "sob", "nd"];

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const user = await requireUser();
  const { owner, people } = await resolveOwner(user, (await searchParams).u);
  const u = owner.id === user.id ? "" : owner.id;
  const month = currentMonth();
  const months = monthsBack(month, 12);
  const [categories, expenses] = await Promise.all([
    listCategories(owner.id),
    listVisibleExpenses(user.id, owner.id, monthRange(months[0]).from, monthRange(month).to),
  ]);
  const categoriesById = categoryMap(categories);
  const category = (id: string) => categoriesById.get(id) ?? UNKNOWN_CATEGORY;

  const monthly = monthlyTotals(expenses, months);
  // Months before the first expense would drag the average down
  const firstActive = monthly.findIndex((m) => m.total > 0);
  const completed = monthly.slice(firstActive === -1 ? monthly.length : firstActive, -1);
  const average = completed.length ? Math.round(total(completed.map((m) => ({ amountPln: m.total }))) / completed.length) : 0;
  const heat = categoryByMonth(expenses);
  const ranking = byCategory(expenses);
  const max = Math.max(1, ...[...heat.values()].flatMap((row) => [...row.values()]));
  const weekdays = byWeekday(expenses);
  const biggest = [...expenses].sort((a, b) => b.amountPln - a.amountPln).slice(0, 5);
  const year = month.slice(0, 4);

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Raporty</h1>
            <PersonSwitcher people={people} owner={owner} viewer={user} path="/reports" />
          </div>
          <p className="mt-1 text-sm text-fg-muted">Ostatnie 12 miesięcy · razem {formatMoney(total(expenses))}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/products?month=${month}&period=year${u ? `&u=${u}` : ""}`} className={buttonClass("secondary")}>Produkty</Link>
          <a href={`/api/export?year=${year}${u ? `&u=${u}` : ""}`} className={buttonClass("secondary")} download>CSV {year}</a>
          <a href={`/api/export?year=${Number(year) - 1}${u ? `&u=${u}` : ""}`} className={buttonClass("secondary")} download>CSV {Number(year) - 1}</a>
        </div>
      </header>

      <Card>
        <CardTitle>Miesiąc po miesiącu{average > 0 && ` · średnio ${formatMoney(average)}`}</CardTitle>
        <BarChart height={200} average={average || undefined}
          bars={monthly.map((m) => ({ key: m.month, label: formatMonthShort(m.month), value: m.total, active: m.month === month, title: `${formatMonth(m.month)}: ${formatMoney(m.total)}` }))} />
      </Card>

      <Card className="mt-3 overflow-x-auto px-3">
        <CardTitle><span className="px-2">Kategorie w czasie</span></CardTitle>
        {ranking.length === 0 ? (
          <p className="px-2 text-sm text-fg-muted">Brak danych.</p>
        ) : (
          <table className="w-full min-w-[48rem] text-xs">
            <thead>
              <tr className="text-fg-muted">
                <th className="px-2 py-1 text-left font-normal">Kategoria</th>
                {months.map((m) => <th key={m} className="px-1 py-1 font-normal capitalize">{formatMonthShort(m)}</th>)}
                <th className="px-2 py-1 text-right font-normal">Razem</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((r) => {
                const c = category(r.categoryId);
                return (
                  <tr key={r.categoryId}>
                    <td className="max-w-44 truncate px-2 py-1">
                      <span className="flex items-center gap-2"><CategoryDot color={c.color} />{c.name}</span>
                    </td>
                    {months.map((m) => {
                      const value = heat.get(r.categoryId)?.get(m) ?? 0;
                      return (
                        <td key={m} className="p-0.5">
                          <Link href={`/expenses?month=${m}&category=${r.categoryId}${u ? `&u=${u}` : ""}`} title={`${c.name}, ${formatMonth(m)}: ${formatMoney(value)}`}
                            className="block rounded-md px-1 py-1.5 text-center tabular transition hover:ring-2 hover:ring-accent"
                            style={{ background: value ? `color-mix(in oklab, ${c.color} ${Math.round(12 + (value / max) * 70)}%, transparent)` : undefined }}>
                            {value ? formatMoneyShort(value).replace(/\s?zł/, "") : "·"}
                          </Link>
                        </td>
                      );
                    })}
                    <td className="px-2 py-1 text-right font-medium tabular">{formatMoney(r.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card>
          <CardTitle>Dni tygodnia</CardTitle>
          <BarChart height={150} bars={weekdays.map((value, i) => ({ key: WEEKDAYS[i], label: WEEKDAYS[i], value, active: i >= 5 }))} />
          <p className="mt-2 text-xs text-fg-muted">Suma z 12 miesięcy; weekend wyróżniony.</p>
        </Card>
        <Card>
          <CardTitle>Największe wydatki</CardTitle>
          <ol className="space-y-2.5 text-sm">
            {biggest.map((e) => (
              <li key={e.id}>
                <Link href={`/expenses/${e.id}${u ? `?u=${u}` : ""}`} className="flex items-center gap-3 hover:underline">
                  <span aria-hidden>{category(e.categoryId).emoji}</span>
                  <span className="flex-1 truncate">{e.merchant} <span className="text-fg-muted">· {e.date}</span></span>
                  <span className="tabular">{formatMoney(e.amountPln)}</span>
                </Link>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </>
  );
}
