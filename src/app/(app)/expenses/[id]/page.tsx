import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { removeExpense } from "@/app/actions/expenses";
import { ExpenseForm } from "@/components/ExpenseForm";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Card, CardTitle, PageHeader } from "@/components/ui";
import { listCategories } from "@/lib/categories";
import { today } from "@/lib/dates";
import { getExpense, recentSuggestions } from "@/lib/expenses";
import { BASE_CURRENCY, formatMoney } from "@/lib/money";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Wydatek" };

const SOURCE = { manual: "Dodany ręcznie", receipt: "Odczytany z paragonu", recurring: "Wydatek cykliczny" };

export default async function ExpensePage({ params }: PageProps<"/expenses/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const [expense, categories, suggestions] = await Promise.all([
    getExpense(user.id, id),
    listCategories(user.id),
    recentSuggestions(user.id),
  ]);
  if (!expense) notFound();

  return (
    <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[1fr_22rem]">
      <div>
        <PageHeader title={expense.merchant}
          subtitle={`${SOURCE[expense.source]}${expense.currency !== BASE_CURRENCY ? ` · ${formatMoney(expense.amountPln)} po kursie NBP ${expense.fxRate}` : ""}`} />
        <Card>
          <ExpenseForm categories={categories} expense={expense} today={today()} merchants={suggestions.merchants} tags={suggestions.tags} />
        </Card>
        <form action={removeExpense} className="mt-4">
          <input type="hidden" name="id" value={expense.id} />
          <ConfirmButton message={`Usunąć wydatek ${expense.merchant}?`}>Usuń wydatek</ConfirmButton>
        </form>
      </div>

      {(expense.receiptPath || (expense.items?.length ?? 0) > 0) && (
        <aside className="space-y-4">
          {expense.items && expense.items.length > 0 && (
            <Card>
              <CardTitle>Pozycje z paragonu</CardTitle>
              <ul className="space-y-1.5 text-sm">
                {expense.items.map((item, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span className="truncate">{item.name}</span>
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
