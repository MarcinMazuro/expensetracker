import { cn } from "@/lib/cn";
import type { BudgetState } from "@/lib/stats";

/** Budget bar; the thin marker shows where spending will land at the current pace. */
export function Progress({ ratio, projectedRatio, state }: { ratio: number; projectedRatio?: number; state: BudgetState }) {
  const fill = { ok: "bg-accent", warning: "bg-warning", over: "bg-danger" }[state];
  return (
    <div className="relative h-2 overflow-hidden rounded-full bg-surface-muted">
      <div className={cn("h-full rounded-full transition-[width]", fill)} style={{ width: `${Math.min(ratio, 1) * 100}%` }} />
      {projectedRatio !== undefined && projectedRatio > ratio && projectedRatio < 1.5 && (
        <div className="absolute top-0 h-full w-0.5 bg-fg/40" style={{ left: `${Math.min(projectedRatio, 1) * 100}%` }}
          title="Prognoza na koniec miesiąca" />
      )}
    </div>
  );
}
