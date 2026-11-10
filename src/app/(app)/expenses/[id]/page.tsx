import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { removeExpense, revealExpense, settleExpense } from "@/app/actions/expenses";
import { Avatar } from "@/components/Avatar";
import { ConfirmButton } from "@/components/ConfirmButton";
import { ExpenseForm } from "@/components/ExpenseForm";
import { Button, Card, CardTitle } from "@/components/ui";
import { listCategories } from "@/lib/categories";
import { formatDateTimeShort, formatDayShort, today } from "@/lib/dates";
import { loadWhole, recentSuggestions } from "@/lib/expenses";
import { BASE_CURRENCY, formatMoney } from "@/lib/money";
import { resolveOwner } from "@/lib/people";
import { formatQuantity } from "@/lib/product-groups";
import { productKey } from "@/lib/products";
import { requireUser } from "@/lib/session";
import { isEqualSplit, normalizeWeights } from "@/lib/sharing";
import { hiddenLines } from "@/lib/visibility";

export const metadata: Metadata = { title: "Wydatek" };

const SOURCE = { manual: "Dodany ręcznie", receipt: "Odczytany z paragonu", recurring: "Wydatek cykliczny" };

export default async function ExpensePage({ params, searchParams }: PageProps<"/expenses/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  // Full access both ways: ?u= opens the other person's expense, with their categories
  const { owner, people: household } = await resolveOwner(user, (await searchParams).u);
  const mine = owner.id === user.id;
  const [loaded, categories, suggestions] = await Promise.all([
    // Someone else's hidden expense is simply not found
    loadWhole(user.id, owner.id, id),
    listCategories(owner.id),
    // Your own suggestions - the other person's would show what they buy in secret
    recentSuggestions(user.id),
  ]);
  if (!loaded) notFound();
  const { expense, whole } = loaded;
  const editor = expense.updatedBy && expense.updatedBy !== owner.id ? household.find((p) => p.id === expense.updatedBy) : undefined;
  const shared = expense.shared;
  const somethingHidden = whole.home === user.id && (whole.hidden || hiddenLines({ items: whole.items, hiddenUntil: whole.hiddenUntil }).length > 0);

  // Who owes whom for this one: everyone but the payer owes their own part
  const payer = shared && household.find((p) => p.id === shared.paidBy);
  const amountOf = (uid: string) => (uid === owner.id ? expense.amount : (shared?.total ?? expense.amount) - expense.amount);
  const debtors = shared ? household.filter((p) => shared.participants.includes(p.id) && p.id !== shared.paidBy && amountOf(p.id) > 0) : [];
  const weights = shared && normalizeWeights(shared.participants, shared.weights);

  return (
    <div className="stagger mx-auto grid max-w-5xl gap-4 lg:grid-cols-[1fr_22rem]">
      <div>
        {!mine && (
          <div className="mb-4 flex items-center gap-3 rounded-3xl px-4 py-3 text-sm"
            style={{ background: `color-mix(in oklab, ${owner.color} 14%, var(--c-surface))` }}>
            <Avatar user={owner} size={36} />
            <span className="flex-1">
              Wydatek z konta: <strong>{owner.name}</strong>. Możesz go zmienić albo usunąć - {owner.name} zobaczy zmiany u siebie.
            </span>
            <Link href={`/expenses?month=${expense.date.slice(0, 7)}&u=${owner.id}`} className="shrink-0 font-medium text-accent">wszystkie</Link>
          </div>
        )}
        {somethingHidden && (
          <form action={revealExpense} className="mb-4 flex flex-wrap items-center gap-3 rounded-3xl border border-accent bg-accent-soft/40 px-4 py-3 text-sm">
            <input type="hidden" name="id" value={expense.id} />
            <span className="text-xl" aria-hidden>🤫</span>
            <span className="min-w-0 flex-1">
              {whole.hidden ? "Ukryty wydatek" : "Część pozycji jest ukryta"}
              {whole.hiddenUntil ? ` - odkryje się sam: ${formatDateTimeShort(whole.hiddenUntil)}` : ", dopóki tego nie odkryjesz"}.
            </span>
            <Button type="submit" variant="secondary">Odkryj teraz</Button>
          </form>
        )}
        <header className="mb-5">
          <h1 className="font-display text-3xl font-semibold tracking-tight">{expense.merchant}</h1>
          <p className="mt-1 text-sm text-fg-muted">
            {SOURCE[expense.source]}
            {expense.currency !== BASE_CURRENCY && `, ${formatMoney(expense.amountPln)} po kursie NBP ${expense.fxRate}`}
            {editor && `, ostatnio zmienił(a) ${editor.name}`}
          </p>
        </header>
        <Card>
          <ExpenseForm me={user} household={household} ownerId={mine ? undefined : owner.id} categories={categories} expense={expense} whole={whole}
            today={today()} merchants={suggestions.merchants} tags={suggestions.tags} />
        </Card>
        <form action={removeExpense} className="mt-4">
          <input type="hidden" name="id" value={expense.id} />
          {!mine && <input type="hidden" name="owner" value={owner.id} />}
          <ConfirmButton message={shared ? `Usunąć wspólny wydatek ${expense.merchant}? Zniknie z obu kont.` : `Usunąć wydatek ${expense.merchant}${mine ? "" : ` z konta ${owner.name}`}?`}>
            {shared ? "Usuń u obojga" : "Usuń wydatek"}
          </ConfirmButton>
        </form>
      </div>

      {(expense.receiptPath || shared || (expense.items?.length ?? 0) > 0) && (
        <aside className="space-y-4">
          {shared && (
            <Card>
              <CardTitle>Wydatek wspólny</CardTitle>
              <ul className="space-y-3">
                {household.filter((p) => shared.participants.includes(p.id)).map((p) => (
                  <li key={p.id} className="flex items-center gap-3 text-sm">
                    <Avatar user={p} size={38} />
                    <span className="flex-1">
                      {p.id === user.id ? `${p.name} (Ty)` : p.name}
                      <span className="block text-xs text-fg-muted">
                        {p.id === shared.paidBy ? "zapłacił(a)" : "oddaje swoją część"}
                        {weights && !isEqualSplit(shared.participants, weights) && `, ${weights[p.id]}% wspólnych`}
                      </span>
                    </span>
                    <span className="font-medium tabular">{formatMoney(amountOf(p.id), expense.currency)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 border-t border-line pt-3 text-xs text-fg-muted">
                Razem {formatMoney(shared.total, expense.currency)}. Zmiany i usunięcie działają na obu kontach.
              </p>

              {payer && debtors.length > 0 && (
                <form action={settleExpense} className="mt-3">
                  <input type="hidden" name="id" value={expense.id} />
                  {!mine && <input type="hidden" name="owner" value={owner.id} />}
                  {shared.settled ? (
                    <div className="flex items-center gap-3 rounded-2xl bg-accent-soft/50 px-3 py-2.5 text-sm">
                      <span className="text-lg" aria-hidden>✅</span>
                      <span className="flex-1">Oddane{shared.settledAt && ` ${formatDayShort(shared.settledAt.slice(0, 10))}`}</span>
                      <button name="settled" value="off" className="text-xs text-fg-muted underline active:scale-95">cofnij</button>
                    </div>
                  ) : (
                    <>
                      <p className="mb-2 text-sm">
                        Do oddania: <strong className="tabular">{formatMoney(debtors.reduce((s, p) => s + amountOf(p.id), 0), expense.currency)}</strong>{" "}
                        <span className="text-fg-muted">({debtors.map((p) => p.name).join(", ")} → {payer.name})</span>
                      </p>
                      <Button type="submit" name="settled" value="on" className="w-full">Oddane</Button>
                    </>
                  )}
                </form>
              )}
            </Card>
          )}
          {expense.items && expense.items.length > 0 && (
            <Card>
              <CardTitle>{shared ? (mine ? "Twoja część pozycji w statystykach" : `Część pozycji w statystykach (${owner.name})`) : "Pozycje w statystykach produktów"}</CardTitle>
              <ul className="space-y-1.5 text-sm">
                {expense.items.map((item, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate">{item.hidden && "🤫 "}{item.name}</span>
                      {item.product && item.unit && item.quantity !== undefined && (
                        <Link href={`/products/${productKey(item.product)}?month=${expense.date.slice(0, 7)}${mine ? "" : `&u=${owner.id}`}`} className="block text-xs text-fg-muted hover:text-accent">
                          {item.product}, {formatQuantity(item.quantity, item.unit)}
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
                  className="max-h-[32rem] w-full rounded-2xl object-contain" loading="lazy" />
              </a>
            </Card>
          )}
        </aside>
      )}
    </div>
  );
}
