import Link from "next/link";
import { currentMonth, formatMonth, shiftMonth } from "@/lib/dates";
import { cn } from "@/lib/cn";

/** ‹ listopad 2026 › - keeps the other query parameters (filters) intact. */
export function MonthSwitcher({ month, path, params = {} }: { month: string; path: string; params?: Record<string, string> }) {
  const href = (m: string) => `${path}?${new URLSearchParams({ ...params, month: m })}`;
  const isCurrent = month >= currentMonth();
  const arrow = "flex size-9 items-center justify-center rounded-xl border border-line bg-surface text-lg transition hover:bg-surface-muted";

  return (
    <div className="flex items-center gap-2">
      <Link href={href(shiftMonth(month, -1))} className={arrow} aria-label="Poprzedni miesiąc">‹</Link>
      <span className="min-w-36 text-center text-sm font-medium capitalize">{formatMonth(month)}</span>
      <Link href={href(shiftMonth(month, 1))} aria-label="Następny miesiąc"
        className={cn(arrow, isCurrent && "pointer-events-none opacity-40")} aria-disabled={isCurrent}>›</Link>
    </div>
  );
}
