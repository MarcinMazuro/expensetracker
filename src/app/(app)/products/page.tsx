import type { Metadata } from "next";
import Link from "next/link";
import { PersonSwitcher } from "@/components/PersonSwitcher";
import { MonthSwitcher } from "@/components/MonthSwitcher";
import { Card, CardTitle, EmptyState, buttonClass, inputClass } from "@/components/ui";
import { cn } from "@/lib/cn";
import { currentMonth, isIsoMonth, monthRange, monthsBack } from "@/lib/dates";
import { listExpenses } from "@/lib/expenses";
import { formatMoney } from "@/lib/money";
import { formatQuantity, isProductGroup, PRODUCT_GROUPS, type Unit } from "@/lib/product-groups";
import { aggregateGroups, aggregateProducts, productLines, type Quantities } from "@/lib/products";
import { resolveOwner } from "@/lib/people";
import { requireUser } from "@/lib/session";
import { matchesQuery } from "@/lib/text";

export const metadata: Metadata = { title: "Produkty" };

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

function QuantityList({ quantities }: { quantities: Quantities }) {
  const parts = (["kg", "l", "szt"] as Unit[]).filter((u) => quantities[u]).map((u) => formatQuantity(quantities[u]!, u));
  return <>{parts.join(" · ") || "-"}</>;
}

export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  const user = await requireUser();
  const params = await searchParams;
  const { owner, people } = await resolveOwner(user, params.u);
  const u = owner.id === user.id ? "" : owner.id;
  const month = isIsoMonth(params.month) ? params.month : currentMonth();
  const year = params.period === "year";
  const group = isProductGroup(params.group) ? params.group : "";
  const q = str(params.q).slice(0, 60);

  const from = year ? monthRange(monthsBack(month, 12)[0]).from : monthRange(month).from;
  const expenses = await listExpenses(owner.id, from, monthRange(month).to);
  const lines = productLines(expenses);
  const groups = aggregateGroups(lines);
  const products = aggregateProducts(lines.filter((l) => (!group || l.group === group) && (!q || matchesQuery(l.product, q))));

  const query = (patch: Record<string, string>) => {
    const next = { month, ...(year && { period: "year" }), ...(group && { group }), ...(q && { q }), ...(u && { u }), ...patch };
    return `/products?${new URLSearchParams(Object.fromEntries(Object.entries(next).filter(([, v]) => v)))}`;
  };
  const switchParams = Object.fromEntries(Object.entries({ period: year ? "year" : "", group, q, u }).filter(([, v]) => v));

  return (
    <>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Produkty</h1>
            <PersonSwitcher people={people} owner={owner} viewer={user} path="/products"
              params={Object.fromEntries(Object.entries({ month, period: year ? "year" : "", group, q }).filter(([, v]) => v))} />
          </div>
          <p className="mt-1 text-sm text-fg-muted">Co, ile i za ile kupujesz - z pozycji zeskanowanych paragonów.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="grid grid-cols-2 rounded-xl border border-line bg-surface p-1 text-sm">
            <Link href={query({ period: "" })} className={cn("rounded-lg px-3 py-1.5", !year && "bg-accent-soft font-medium text-accent")}>Miesiąc</Link>
            <Link href={query({ period: "year" })} className={cn("rounded-lg px-3 py-1.5", year && "bg-accent-soft font-medium text-accent")}>12 miesięcy</Link>
          </div>
          <MonthSwitcher month={month} path="/products" params={switchParams} />
        </div>
      </header>

      {lines.length === 0 ? (
        <EmptyState title="Brak pozycji z paragonów w tym okresie">
          Statystyki produktów powstają ze <Link href="/scan" className="text-accent hover:underline">skanowanych paragonów</Link> - wydatki wpisane ręcznie nie mają pozycji.
        </EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {groups.map((g) => (
              <Link key={g.group} href={query({ group: group === g.group ? "" : g.group })}
                className={cn("rounded-2xl border bg-surface p-4 transition hover:border-accent", group === g.group ? "border-accent ring-2 ring-accent/20" : "border-line")}>
                <p className="flex items-center gap-2 text-sm text-fg-muted">
                  <span aria-hidden>{PRODUCT_GROUPS[g.group].emoji}</span>
                  <span className="truncate">{PRODUCT_GROUPS[g.group].name}</span>
                </p>
                <p className="mt-1 text-lg font-semibold tabular">{formatMoney(g.spend)}</p>
                <p className="mt-0.5 text-xs text-fg-muted tabular"><QuantityList quantities={g.quantities} /></p>
              </Link>
            ))}
          </div>

          <form className="mt-3 flex gap-2" role="search">
            <input type="hidden" name="month" value={month} />
            {year && <input type="hidden" name="period" value="year" />}
            {group && <input type="hidden" name="group" value={group} />}
            {u && <input type="hidden" name="u" value={u} />}
            <input name="q" defaultValue={q} placeholder="Szukaj produktu, np. marchew" className={inputClass} />
            <button className={buttonClass("secondary")}>Szukaj</button>
          </form>

          <Card className="mt-3 px-3">
            <CardTitle>
              <span className="px-2">
                {group ? PRODUCT_GROUPS[group].name : "Wszystkie produkty"} · {products.length}
                {(group || q) && <Link href={query({ group: "", q: "" })} className="ml-2 text-accent hover:underline">wyczyść</Link>}
              </span>
            </CardTitle>
            {/* Phone: two-line rows instead of a table that would scroll sideways */}
            <ul className="divide-y divide-line sm:hidden">
              {products.map((p) => (
                <li key={p.key}>
                  <Link href={`/products/${p.key}?month=${month}${u ? `&u=${u}` : ""}`} className="flex items-center gap-3 px-2 py-2.5">
                    <span aria-hidden>{PRODUCT_GROUPS[p.group].emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium first-letter:uppercase">{p.product}</span>
                      <span className="block text-xs text-fg-muted tabular">
                        {p.purchases}× {p.unitPrice !== null && `· śr. ${formatMoney(p.unitPrice)}/${p.mainUnit === "szt" ? "szt." : p.mainUnit}`}
                      </span>
                    </span>
                    <span className="text-right text-sm tabular">
                      <span className="block font-medium">{formatMoney(p.spend)}</span>
                      <span className="block text-xs text-fg-muted"><QuantityList quantities={p.quantities} /></span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className="text-left text-xs text-fg-muted">
                    <th className="px-2 py-2 font-normal">Produkt</th>
                    <th className="px-2 py-2 text-right font-normal">Ilość</th>
                    <th className="px-2 py-2 text-right font-normal">Średnia cena</th>
                    <th className="px-2 py-2 text-right font-normal">Zakupy</th>
                    <th className="px-2 py-2 text-right font-normal">Wydano</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {products.map((p) => (
                    <tr key={p.key} className="transition hover:bg-surface-muted">
                      <td className="px-2 py-2.5">
                        <Link href={`/products/${p.key}?month=${month}${u ? `&u=${u}` : ""}`} className="flex items-center gap-2 font-medium first-letter:uppercase hover:underline">
                          <span aria-hidden>{PRODUCT_GROUPS[p.group].emoji}</span>{p.product}
                        </Link>
                      </td>
                      <td className="px-2 py-2.5 text-right tabular"><QuantityList quantities={p.quantities} /></td>
                      <td className="px-2 py-2.5 text-right text-fg-muted tabular">
                        {p.unitPrice !== null ? `${formatMoney(p.unitPrice)}/${p.mainUnit === "szt" ? "szt." : p.mainUnit}` : "-"}
                      </td>
                      <td className="px-2 py-2.5 text-right text-fg-muted tabular">{p.purchases}×</td>
                      <td className="px-2 py-2.5 text-right font-medium tabular">{formatMoney(p.spend)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {products.length === 0 && <p className="px-2 py-4 text-sm text-fg-muted">Nic nie pasuje.</p>}
          </Card>
        </>
      )}
    </>
  );
}
