"use client";

import { Avatar } from "@/components/Avatar";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { SPLIT } from "@/lib/sharing";
import type { User } from "@/lib/types";

export type Person = Pick<User, "id" | "name" | "color" | "picture" | "avatar">;

const PRESETS = [50, 60, 70, 100];

/**
 * "Wspólny wydatek": who paid and how it is divided. The two avatars grow
 * and shrink with their share, so the split is visible before reading a number.
 */
export function ShareControls({ people, me, shared, onShared, paidBy, onPaidBy, weights, onWeights, parts, currency, hasLines }: {
  /** The people taking part, the viewer first. */
  people: Person[];
  me: Person;
  shared: boolean;
  onShared: (value: boolean) => void;
  paidBy: string;
  onPaidBy: (id: string) => void;
  weights: Record<string, number>;
  onWeights: (weights: Record<string, number>) => void;
  /** Each person's amount as it will be saved. */
  parts: Record<string, number>;
  currency: string;
  hasLines: boolean;
}) {
  const [first, second] = people;
  const label = (p: Person) => (p.id === me.id ? "Ty" : p.name);
  const firstShare = weights[first.id] ?? 50;
  const setFirst = (value: number) => onWeights({ [first.id]: value, [second.id]: 100 - value });

  return (
    <div className={cn("rounded-3xl border transition-colors", shared ? "border-accent bg-accent-soft/35" : "border-line")}>
      <label className="flex cursor-pointer items-center gap-4 p-4">
        <input type="checkbox" name="shared" checked={shared} onChange={(e) => onShared(e.target.checked)} className="size-5 accent-[var(--c-accent)]" />
        <span className="flex -space-x-2">{people.map((p) => <Avatar key={p.id} user={p} size={34} ring />)}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">Wspólny wydatek</span>
          <span className="block text-xs text-fg-muted">
            {shared ? people.map((p) => `${label(p)} ${formatMoney(parts[p.id] ?? 0, currency)}`).join(" · ") : "Podziel między was - po równo albo inaczej"}
          </span>
        </span>
      </label>

      {shared && second && (
        <div className="animate-rise space-y-4 border-t border-line/70 p-4">
          <input type="hidden" name="paidBy" value={paidBy} />
          <input type="hidden" name="weights" value={JSON.stringify(weights)} />

          <div>
            <p className="mb-2 text-xs font-medium text-fg-muted">Kto zapłacił</p>
            <div className="grid grid-cols-2 gap-2">
              {people.map((p) => (
                <button key={p.id} type="button" onClick={() => onPaidBy(p.id)} aria-pressed={paidBy === p.id}
                  className={cn("flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm transition active:scale-[0.97]",
                    paidBy === p.id ? "border-accent bg-surface font-medium shadow-card" : "border-line/70 text-fg-muted")}>
                  <Avatar user={p} size={26} /> {label(p)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium text-fg-muted">{hasLines ? "Podział wspólnych pozycji" : "Podział"}</p>
            <div className="flex items-end justify-between gap-3">
              {[first, second].map((p, i) => {
                const share = i === 0 ? firstShare : 100 - firstShare;
                return (
                  <div key={p.id} className={cn("flex flex-col items-center gap-1", i === 1 && "order-last")}>
                    <span className="transition-transform duration-300 ease-out" style={{ transform: `scale(${0.7 + share / 125})`, transformOrigin: "bottom" }}>
                      <Avatar user={p} size={44} />
                    </span>
                    <span className="font-display text-lg leading-none font-semibold tabular">{share}%</span>
                  </div>
                );
              })}
              {/* The thumb is the border between the two: drag it to move the split */}
              <input type="range" min={0} max={100} step={5} value={firstShare} onChange={(e) => setFirst(Number(e.target.value))}
                aria-label={`Udział: ${label(first)}`}
                className="mb-2 h-2.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full accent-[var(--c-fg)]"
                style={{ background: `linear-gradient(90deg, ${first.color} ${firstShare}%, ${second.color} ${firstShare}%)` }} />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {PRESETS.map((value) => (
                <button key={value} type="button" onClick={() => setFirst(value)}
                  className={cn("rounded-full border px-3 py-1 text-xs transition active:scale-95", firstShare === value ? "border-accent bg-accent text-accent-fg" : "border-line bg-surface text-fg-muted")}>
                  {value === 50 ? "po równo" : `${value}/${100 - value}`}
                </button>
              ))}
              <button type="button" onClick={() => setFirst(0)}
                className={cn("rounded-full border px-3 py-1 text-xs transition active:scale-95", firstShare === 0 ? "border-accent bg-accent text-accent-fg" : "border-line bg-surface text-fg-muted")}>
                0/100
              </button>
            </div>
          </div>
          {hasLines && <p className="text-xs text-fg-muted">Przy każdej pozycji niżej wybierzesz, czy jest wspólna, czy tylko jednej osoby.</p>}
        </div>
      )}
    </div>
  );
}

/** Whose line it is: tap to go round "wspólna" - mine - the other person's. */
export function AssignChip({ value, onChange, people, me }: { value: string; onChange: (value: string) => void; people: Person[]; me: Person }) {
  const order = [SPLIT, ...people.map((p) => p.id)];
  const current = order.includes(value) ? value : SPLIT;
  const owner = people.find((p) => p.id === current);
  return (
    <button type="button" onClick={() => onChange(order[(order.indexOf(current) + 1) % order.length])}
      aria-label={`Czyja pozycja: ${owner ? (owner.id === me.id ? "moja" : owner.name) : "wspólna"}. Stuknij, żeby zmienić`}
      className="flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface pr-2.5 pl-1 text-xs transition active:scale-90">
      <span key={current} className="flex animate-pop -space-x-1.5">
        {(owner ? [owner] : people).map((p) => <Avatar key={p.id} user={p} size={22} ring />)}
      </span>
      {owner ? (owner.id === me.id ? "moja" : owner.name) : "wspólna"}
    </button>
  );
}

/** Hide one line from the other person. */
export function HideChip({ hidden, onChange }: { hidden: boolean; onChange: (value: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!hidden)} aria-pressed={hidden}
      aria-label={hidden ? "Pozycja ukryta - stuknij, żeby pokazać" : "Ukryj tę pozycję przed drugą osobą"}
      className={cn("flex h-8 items-center gap-1 rounded-full border px-2.5 text-xs transition active:scale-90",
        hidden ? "border-accent bg-accent text-accent-fg" : "border-line bg-surface text-fg-muted")}>
      <span key={String(hidden)} className="animate-pop" aria-hidden>{hidden ? "🤫" : "👁"}</span>
      {hidden ? "ukryta" : "widoczna"}
    </button>
  );
}
