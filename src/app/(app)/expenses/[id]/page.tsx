import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { removeExpense } from "@/app/actions/expenses";
import { ExpenseForm } from "@/components/ExpenseForm";
import { Avatar } from "@/components/Avatar";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Card, CardTitle, PageHeader } from "@/components/ui";
import { listCategories } from "@/lib/categories";
import { today } from "@/lib/dates";
import { getExpense, recentSuggestions } from "@/lib/expenses";
import { BASE_CURRENCY, formatMoney } from "@/lib/money";
import { formatQuantity } from "@/lib/product-groups";
import { productKey } from "@/lib/products";
import { resolveOwner } from "@/lib/people";
import { requireUser } from "@/lib/session";
import { splitAmount } from "@/lib/split";

export const metadata: Metadata = { title: "Wydatek" };

const SOURCE = { manual: "Dodany ręcznie", receipt: "Odczytany z paragonu", recurring: "Wydatek cykliczny" };

export default async function ExpensePage({ params, searchParams }: PageProps<"/expenses/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  // Full access both ways: ?u= opens the other person's expense, with their categories
  const { owner, people: household } = await resolveOwner(user, (await searchParams).u);
  const mine = owner.id === user.id;
  const [expense, categories, suggestions] = await Promise.all([
    getExpense(owner.id, id),
    listCategories(owner.id),
    recentSuggestions(owner.id),
  ]);
  if (!expense) notFound();
  const editor = expense.updatedBy && expense.updatedBy !== owner.id ? household.find((p) => p.id === expense.updatedBy) : undefined;

  return (
    <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[1fr_22rem]">
      <div>
        {!mine && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm"
            style={{ background: `color-mix(in oklab, ${owner.color} 14%, var(--c-surface))` }}>
            <Avatar user={owner} size={36} />
            <span className="flex-1">
              Wydatek z konta: <strong>{owner.name}</strong>. Możesz go zmienić albo usunąć - {owner.name} zobaczy zmiany u siebie.
            </span>
            <Link href={`/expenses?month=${expense.date.slice(0, 7)}&u=${owner.id}`} className="shrink-0 text-accent hover:underline">wszystkie →</Link>
          </div>
        )}
        <PageHeader title={expense.merchant}
          subtitle={`${SOURCE[expense.source]}${expense.currency !== BASE_CURRENCY ? ` · ${formatMoney(expense.amountPln)} po kursie NBP ${expense.fxRate}` : ""}${editor ? ` · ostatnio zmienił(a) ${editor.name}` : ""}`} />
        <Card>
          <ExpenseForm me={user} household={household} ownerId={mine ? undefined : owner.id} categories={categories} expense={expense} today={today()} merchants={suggestions.merchants} tags={suggestions.tags} />
        </Card>
        <form action={removeExpense} className="mt-4">
          <input type="hidden" name="id" value={expense.id} />
          {!mine && <input type="hidden" name="owner" value={owner.id} />}
          <ConfirmButton message={expense.shared ? `Usunąć wspólny wydatek ${expense.merchant}? Zniknie z obu kont.` : `Usunąć wydatek ${expense.merchant}${mine ? "" : ` z konta ${owner.name}`}?`}>
            {expense.shared ? "Usuń u obojga" : "Usuń wydatek"}
          </ConfirmButton>
        </form>
      </div>

      {(expense.receiptPath || expense.shared || (expense.items?.length ?? 0) > 0) && (
        <aside className="space-y-4">
          {expense.shared && (
            <Card>
              <CardTitle>Wydatek wspólny</CardTitle>
              <ul className="space-y-3">
                {household.filter((p) => expense.shared!.participants.includes(p.id)).map((p) => (
                  <li key={p.id} className="flex items-center gap-3 text-sm">
                    <Avatar user={p} size={36} />
                    <span className="flex-1">
                      {p.id === user.id ? `${p.name} (Ty)` : p.name}
                      {p.id === expense.shared!.paidBy && <span className="block text-xs text-fg-muted">zapłacił(a)</span>}
                    </span>
                    <span className="tabular">
                      {formatMoney(splitAmount(expense.shared!.total, expense.shared!.participants.length, expense.shared!.participants.indexOf(expense.shared!.paidBy))[expense.shared!.participants.indexOf(p.id)], expense.currency)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 border-t border-line pt-3 text-xs text-fg-muted">
                Razem {formatMoney(expense.shared.total, expense.currency)}. Zmiany i usunięcie działają na obu kontach.
              </p>
            </Card>
          )}
          {expense.items && expense.items.length > 0 && (
            <Card>
              <CardTitle>{expense.shared ? (mine ? "Twoja część pozycji w statystykach" : `Część pozycji w statystykach (${owner.name})`) : "Pozycje w statystykach produktów"}</CardTitle>
              <ul className="space-y-1.5 text-sm">
                {expense.items.map((item, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate">{item.name}</span>
                      {item.product && item.unit && item.quantity !== undefined && (
                        <Link href={`/products/${productKey(item.product)}?month=${expense.date.slice(0, 7)}${mine ? "" : `&u=${owner.id}`}`} className="block text-xs text-fg-muted hover:text-accent">
                          {item.product} · {formatQuantity(item.quantity, item.unit)}
                        </Link>
                      )}
                    </span>
                    <span className="shrink-0 tabular">{formatMoney(item.amount, expense.currency)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {expense.receiptPath && (
            <Card className="p-2">
              <a href={`/api/receipts?path=${encodeURIComponent(expense.receiptPath)}`} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/receipts?path=${encodeURIComponent(expense.receiptPath)}`} alt="Zdjęcie paragonu"
                  className="max-h-[32rem] w-full rounded-xl object-contain" loading="lazy" />
              </a>
            </Card>
          )}
        </aside>
      )}
    </div>
  );
}
