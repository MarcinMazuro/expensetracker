"use client";

import { inputClass } from "@/components/ui";
import { cn } from "@/lib/cn";

export type HiddenMode = "manual" | "time";

/**
 * "Hide from the other person": the whole expense, and how anything hidden
 * (the expense or single lines) gets revealed. Field names match parseHidden.
 */
export function HiddenFields({ hidden, onHidden, mode, onMode, until, onUntil, otherName, hiddenLines = 0, wholeAllowed = true }: {
  hidden: boolean;
  onHidden: (value: boolean) => void;
  mode: HiddenMode;
  onMode: (value: HiddenMode) => void;
  until: string;
  onUntil: (value: string) => void;
  otherName?: string;
  /** How many single lines are hidden - they use the same reveal settings. */
  hiddenLines?: number;
  /** A shared expense cannot be hidden as a whole. */
  wholeAllowed?: boolean;
}) {
  const active = hidden || hiddenLines > 0;
  return (
    <div className={cn("rounded-3xl border transition-colors", active ? "border-accent bg-accent-soft/35" : "border-line")}>
      {wholeAllowed ? (
        <label className="flex cursor-pointer items-center gap-4 p-4">
          <input type="checkbox" name="hidden" checked={hidden} onChange={(e) => onHidden(e.target.checked)} className="size-5 accent-[var(--c-accent)]" />
          <span className="text-2xl" aria-hidden>🤫</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">Ukryty wydatek</span>
            <span className="block text-xs text-fg-muted">
              {hiddenLines > 0 && !hidden
                ? `Ukryte pozycje: ${hiddenLines}. ${otherName ?? "Druga osoba"} zobaczy wydatek bez nich i bez ich ceny`
                : `${otherName ?? "Druga osoba"} nie zobaczy go nigdzie, także w sumach`}
            </span>
          </span>
        </label>
      ) : (
        <p className="flex items-center gap-3 p-4 text-sm">
          <span className="text-2xl" aria-hidden>🤫</span>
          <span>
            <span className="block font-medium">Ukryte pozycje: {hiddenLines}</span>
            <span className="block text-xs text-fg-muted">{otherName ?? "Druga osoba"} nie zobaczy ich ani ich ceny. Są tylko Twoje.</span>
          </span>
        </p>
      )}
      {active && (
        <div className="animate-rise space-y-2 border-t border-line/70 p-4 text-sm">
          <label className="flex cursor-pointer items-center gap-3">
            <input type="radio" name="hiddenMode" value="manual" checked={mode === "manual"} onChange={() => onMode("manual")} className="size-4 accent-[var(--c-accent)]" />
            Pokaż dopiero, gdy kliknę „Odkryj”
          </label>
          <label className="flex cursor-pointer items-center gap-3">
            <input type="radio" name="hiddenMode" value="time" checked={mode === "time"} onChange={() => onMode("time")} className="size-4 accent-[var(--c-accent)]" />
            Pokaż automatycznie o wybranym czasie
          </label>
          {mode === "time" && (
            <input type="datetime-local" name="hiddenUntil" value={until} onChange={(e) => onUntil(e.target.value)} required
              aria-label="Kiedy odkryć" className={cn(inputClass, "mt-1")} />
          )}
        </div>
      )}
    </div>
  );
}
