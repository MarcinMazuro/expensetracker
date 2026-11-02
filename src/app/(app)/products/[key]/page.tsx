import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BarChart } from "@/components/charts/BarChart";
import { Card, CardTitle } from "@/components/ui";
import { currentMonth, formatDayShort, formatMonth, formatMonthShort, isIsoMonth, monthRange, monthsBack } from "@/lib/dates";
import { listExpenses } from "@/lib/expenses";
import { formatMoney } from "@/lib/money";
import { formatQuantity, PRODUCT_GROUPS } from "@/lib/product-groups";
import { aggregateProducts, priceByMerchant, productHistory, productLines } from "@/lib/products";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Produkt" };

export default async function ProductPage({ params, searchParams }: PageProps<"/products/[key]">) {
  const user = await requireUser();
  const { key } = await params;
  const { month: monthParam } = await searchParams;
  const month = isIsoMonth(monthParam) ? monthParam : currentMonth();
  const months = monthsBack(month, 12);

  const expenses = await listExpenses(user.id, monthRange(months[0]).from, monthRange(month).to);
  const lines = productLines(expenses).filter((l) => l.key === decodeURIComponent(key));
  if (lines.length === 0) notFound();

  const [summary] = aggregateProducts(lines);
  const unit = summary.mainUnit;
  const unitLabel = unit === "szt" ? "szt." : unit;
  const history = productHistory(lines, months, unit);
  const shops = priceByMerchant(lines, unit);
  const priced = history.filter((h) => h.unitPrice !== null);
  const recent = [...lines].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);

  return (
    <>
      <header className="mb-6">
        <Link href={`/products?month=${month}&period=year`} className="text-sm text-accent hover:underline">← Produkty</Link>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold tracking-tight first-letter:uppercase">
          <span aria-hidden>{PRODUCT_GROUPS[summary.group].emoji}</span>{summary.product}
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          {PRODUCT_GROUPS[summary.group].name} · {formatMonth(months[0])} - {formatMonth(month)}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <p className="text-sm text-fg-muted">Kupiono</p>
          <p className="mt-1 text-xl font-semibold tabular">{formatQuantity(summary.quantities[unit] ?? 0, unit)}</p>
        </Card>
        <Card>
          <p className="text-sm text-fg-muted">Wydano</p>
          <p className="mt-1 text-xl font-semibold tabular">{formatMoney(summary.spend)}</p>
        </Card>
        <Card>
          <p className="text-sm text-fg-muted">Średnia cena</p>
          <p className="mt-1 text-xl font-semibold tabular">{summary.unitPrice !== null ? `${formatMoney(summary.unitPrice)}/${unitLabel}` : "-"}</p>
        </Card>
        <Card>
          <p className="text-sm text-fg-muted">Zakupy</p>
          <p className="mt-1 text-xl font-semibold tabular">{summary.purchases}×</p>
        </Card>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card>
          <CardTitle>Ilość miesiąc po miesiącu ({unitLabel})</CardTitle>
          <BarChart height={170} format={(q) => formatQuantity(q, unit)}
            bars={history.map((h) => ({ key: h.month, label: formatMonthShort(h.month), value: h.quantity, active: h.month === month,
              title: `${formatMonth(h.month)}: ${formatQuantity(h.quantity, unit)}, ${formatMoney(h.spend)}` }))} />
        </Card>
        <Card>
          <CardTitle>Cena za {unitLabel} w czasie</CardTitle>
          {priced.length < 2 ? (
            <p className="text-sm text-fg-muted">Za mało zakupów, żeby pokazać zmianę ceny.</p>
          ) : (
            <BarChart height={170}
              bars={history.map((h) => ({ key: h.month, label: formatMonthShort(h.month), value: h.unitPrice ?? 0, active: h.month === month,
                title: h.unitPrice !== null ? `${formatMonth(h.month)}: ${formatMoney(h.unitPrice)}/${unitLabel}` : `${formatMonth(h.month)}: brak zakupów` }))} />
          )}
        </Card>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card>
          <CardTitle>Gdzie najtaniej</CardTitle>
          <ol className="space-y-2.5 text-sm">
            {shops.map((s, i) => (
              <li key={s.merchant} className="flex items-center gap-3">
                <span className="flex size-7 items-center justify-center rounded-lg bg-surface-muted text-xs font-medium">{i + 1}</span>
                <span className="flex-1 truncate">{s.merchant} <span className="text-fg-muted">· {s.purchases}×</span></span>
                <span className="tabular">{formatMoney(s.unitPrice)}/{unitLabel}</span>
              </li>
            ))}
          </ol>
        </Card>
        <Card className="px-3">
          <CardTitle><span className="px-2">Ostatnie zakupy</span></CardTitle>
          <ul className="divide-y divide-line text-sm">
            {recent.map((l, i) => (
              <li key={`${l.expenseId}-${i}`}>
                <Link href={`/expenses/${l.expenseId}`} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-muted">
                  <span className="w-14 shrink-0 text-fg-muted">{formatDayShort(l.date)}</span>
                  <span className="flex-1 truncate">{l.merchant}</span>
                  <span className="text-fg-muted tabular">{formatQuantity(l.quantity, l.unit)}</span>
                  <span className="w-20 text-right tabular">{formatMoney(l.amountPln)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
