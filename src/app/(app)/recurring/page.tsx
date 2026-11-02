import type { Metadata } from "next";
import { deleteRecurring, toggleRecurring } from "@/app/actions/recurring";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Card, CardTitle, EmptyState, PageHeader } from "@/components/ui";
import { categoryMap, listCategories, UNKNOWN_CATEGORY } from "@/lib/categories";
import { formatDayShort, today } from "@/lib/dates";
import { BASE_CURRENCY, formatMoney } from "@/lib/money";
import { bookDueRecurring, listRecurring } from "@/lib/recurring";
import { monthlyEquivalent } from "@/lib/recurring-schedule";
import { requireUser } from "@/lib/session";
import { INTERVALS } from "@/lib/validation";
import { RecurringForm } from "./RecurringForm";

export const metadata: Metadata = { title: "Wydatki cykliczne" };

export default async function RecurringPage() {
  const user = await requireUser();
  await bookDueRecurring(user.id);
  const [rules, categories] = await Promise.all([listRecurring(user.id), listCategories(user.id)]);
  const categoriesById = categoryMap(categories);
  const active = rules.filter((r) => r.active);
  // Foreign currencies are counted at face value here - this is only an estimate
  const monthly = active.reduce((s, r) => s + monthlyEquivalent(r.amount, r.interval), 0);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Wydatki cykliczne"
        subtitle={active.length ? `Aktywne: ${active.length} · ok. ${formatMoney(monthly)} miesięcznie, ${formatMoney(monthly * 12)} rocznie` : "Abonamenty, czynsz, raty - księgują się same w dniu płatności."} />

      {rules.length === 0 ? (
        <EmptyState title="Brak wydatków cyklicznych">Dodaj pierwszy poniżej.</EmptyState>
      ) : (
        <Card className="px-3">
          <ul className="divide-y divide-line">
            {rules.map((r) => {
              const c = categoriesById.get(r.categoryId) ?? UNKNOWN_CATEGORY;
              return (
                <li key={r.id} className={`flex flex-wrap items-center gap-3 px-2 py-3 ${r.active ? "" : "opacity-50"}`}>
                  <span className="text-lg" aria-hidden>{c.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{r.name}</span>
                    <span className="block text-xs text-fg-muted">
                      {INTERVALS[r.interval]} · {r.active ? `następna ${formatDayShort(r.nextDate)}` : "wstrzymana"}
                    </span>
                  </span>
                  <span className="font-medium tabular">{formatMoney(r.amount, r.currency)}{r.currency !== BASE_CURRENCY && "*"}</span>
                  <span className="flex gap-1">
                    <form action={toggleRecurring}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="rounded-lg px-2 py-1 text-xs text-fg-muted hover:bg-surface-muted">{r.active ? "Wstrzymaj" : "Wznów"}</button>
                    </form>
                    <form action={deleteRecurring}>
                      <input type="hidden" name="id" value={r.id} />
                      <ConfirmButton message={`Usunąć ${r.name}? Zaksięgowane już wydatki zostaną.`} variant="ghost">Usuń</ConfirmButton>
                    </form>
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Card className="mt-4">
        <CardTitle>Nowy wydatek cykliczny</CardTitle>
        <RecurringForm categories={categories} today={today()} />
      </Card>
    </div>
  );
}
