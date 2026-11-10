import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { formatDateTimeShort, formatDayShort } from "@/lib/dates";
import { BASE_CURRENCY, formatMoney } from "@/lib/money";
import type { Category, Expense, User } from "@/lib/types";
import { hiddenLines, isHiddenNow } from "@/lib/visibility";

const SOURCE_ICON = { manual: null, receipt: "🧾", recurring: "🔁" } as const;

type Person = Pick<User, "id" | "name" | "color" | "picture" | "avatar">;

export function ExpenseRow({ expense, category, showDate = false, people = [], ownerId }: {
  expense: Expense;
  category: Category;
  showDate?: boolean;
  /** Household members - shown on shared expenses. */
  people?: Person[];
  /** Set when the expense belongs to the other person. */
  ownerId?: string;
}) {
  const sharers = expense.shared ? people.filter((p) => expense.shared!.participants.includes(p.id)) : [];
  const wholeHidden = isHiddenNow(expense);
  // Only the owner's own list carries hidden lines; for the other person they are already gone
  const secretLines = wholeHidden ? 0 : hiddenLines(expense).length;
  return (
    <Link href={`/expenses/${expense.id}${ownerId ? `?u=${ownerId}` : ""}`}
      className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-surface-muted">
      <span className="relative">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl text-lg"
          style={{ background: `color-mix(in oklab, ${category.color} 18%, transparent)` }} aria-hidden>
          {category.emoji}
        </span>
        {sharers.length > 0 && (
          <span className="absolute -right-2 -bottom-1 flex -space-x-1.5">
            {sharers.map((p) => <Avatar key={p.id} user={p} size={18} ring />)}
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1 pl-0.5">
        <span className="flex items-center gap-1.5 font-medium">
          <span className="truncate">{expense.merchant}</span>
          {expense.shared && <span className="shrink-0 rounded-full bg-accent-soft px-1.5 py-px text-[10px] font-medium text-accent">wspólny</span>}
          {wholeHidden && <span className="shrink-0 rounded-full bg-accent-soft px-1.5 py-px text-[10px] font-medium text-accent">🤫 ukryty</span>}
          {secretLines > 0 && <span className="shrink-0 rounded-full bg-accent-soft px-1.5 py-px text-[10px] font-medium text-accent" title="Ukryte pozycje">🤫 {secretLines} poz.</span>}
          {expense.unsettled && <span className="shrink-0 rounded-full bg-warning-soft px-1.5 py-px text-[10px] font-medium text-warning">do oddania</span>}
          {expense.shared?.settled && <span className="shrink-0 rounded-full bg-surface-muted px-1.5 py-px text-[10px] font-medium text-fg-muted">oddane</span>}
          {SOURCE_ICON[expense.source] && <span className="text-xs" title={expense.source === "receipt" ? "Z paragonu" : "Cykliczny"}>{SOURCE_ICON[expense.source]}</span>}
        </span>
        <span className="block truncate text-xs text-fg-muted">
          {(wholeHidden || secretLines > 0) && expense.hiddenUntil && `odkryje się ${formatDateTimeShort(expense.hiddenUntil)} · `}
          {category.name}
          {showDate && ` · ${formatDayShort(expense.date)}`}
          {expense.items?.length ? ` · ${expense.items.length} poz.` : ""}
          {expense.tags.length > 0 && ` · ${expense.tags.map((t) => `#${t}`).join(" ")}`}
          {expense.note && ` · ${expense.note}`}
        </span>
      </span>
      <span className="text-right">
        <span className="block font-medium tabular">{formatMoney(expense.amountPln)}</span>
        {expense.shared ? (
          <span className="block text-xs text-fg-muted tabular">z {formatMoney(expense.shared.total, expense.currency)}</span>
        ) : expense.currency !== BASE_CURRENCY && (
          <span className="block text-xs text-fg-muted tabular">{formatMoney(expense.amount, expense.currency)}</span>
        )}
      </span>
    </Link>
  );
}
