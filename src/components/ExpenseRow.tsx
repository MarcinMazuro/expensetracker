import Link from "next/link";
import { formatDayShort } from "@/lib/dates";
import { BASE_CURRENCY, formatMoney } from "@/lib/money";
import type { Category, Expense } from "@/lib/types";

const SOURCE_ICON = { manual: null, receipt: "🧾", recurring: "🔁" } as const;

export function ExpenseRow({ expense, category, showDate = false }: { expense: Expense; category: Category; showDate?: boolean }) {
  return (
    <Link href={`/expenses/${expense.id}`}
      className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-surface-muted">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl text-lg"
        style={{ background: `color-mix(in oklab, ${category.color} 18%, transparent)` }} aria-hidden>
        {category.emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 truncate font-medium">
          {expense.merchant}
          {SOURCE_ICON[expense.source] && <span className="text-xs" title={expense.source === "receipt" ? "Z paragonu" : "Cykliczny"}>{SOURCE_ICON[expense.source]}</span>}
        </span>
        <span className="block truncate text-xs text-fg-muted">
          {category.name}
          {showDate && ` · ${formatDayShort(expense.date)}`}
          {expense.tags.length > 0 && ` · ${expense.tags.map((t) => `#${t}`).join(" ")}`}
          {expense.note && ` · ${expense.note}`}
        </span>
      </span>
      <span className="text-right">
        <span className="block font-medium tabular">{formatMoney(expense.amountPln)}</span>
        {expense.currency !== BASE_CURRENCY && (
          <span className="block text-xs text-fg-muted tabular">{formatMoney(expense.amount, expense.currency)}</span>
        )}
      </span>
    </Link>
  );
}
