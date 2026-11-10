/**
 * Charts of the shared view. Plain server-rendered SVG and CSS, coloured by
 * person (user.color), so the same colour means the same person everywhere.
 */
import { Avatar } from "@/components/Avatar";
import { formatMonth, formatMonthShort } from "@/lib/dates";
import { formatMoney, formatMoneyShort } from "@/lib/money";
import type { User } from "@/lib/types";

/** One bar split into each person's share. */
export function ShareBar({ people }: { people: { user: User; total: number; share: number }[] }) {
  const sum = people.reduce((s, p) => s + p.total, 0);
  return (
    <div>
      <div className="grow-x flex h-3.5 overflow-hidden rounded-full bg-surface-muted" role="img"
        aria-label={people.map((p) => `${p.user.name} ${Math.round(p.share * 100)}%`).join(", ")}>
        {sum > 0 && people.map((p) => (
          <div key={p.user.id} className="h-full transition-[width] first:rounded-l-full last:rounded-r-full"
            style={{ width: `${p.share * 100}%`, background: p.user.color }} />
        ))}
      </div>
    </div>
  );
}

/**
 * Running total through the month, one line per person - who is "ahead"
 * and how fast each line climbs.
 */
export function RaceChart({ series, days, height = 220 }: { series: { user: User; points: number[] }[]; days: number; height?: number }) {
  const width = 600;
  const pad = { top: 14, right: 12, bottom: 28, left: 8 };
  const max = Math.max(1, ...series.flatMap((s) => s.points));
  const x = (i: number) => pad.left + (i / Math.max(days - 1, 1)) * (width - pad.left - pad.right);
  const y = (v: number) => pad.top + (1 - v / max) * (height - pad.top - pad.bottom);
  const gridValues = [0.25, 0.5, 0.75, 1].map((f) => f * max);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: height }} role="img"
      aria-label={series.map((s) => `${s.user.name}: ${formatMoney(s.points.at(-1) ?? 0)}`).join(", ")}>
      <defs>
        {series.map((s) => (
          <linearGradient key={s.user.id} id={`fill-${s.user.id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={s.user.color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={s.user.color} stopOpacity={0} />
          </linearGradient>
        ))}
      </defs>
      {gridValues.map((v) => (
        <g key={v}>
          <line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} className="stroke-line" strokeDasharray="3 4" />
          <text x={width - pad.right} y={y(v) - 4} textAnchor="end" className="fill-fg-muted text-[13px] tabular">{formatMoneyShort(v)}</text>
        </g>
      ))}
      {[1, 8, 15, 22, days].map((d) => (
        <text key={d} x={x(d - 1)} y={height - 6} textAnchor="middle" className="fill-fg-muted text-[13px]">{d}</text>
      ))}
      {series.map((s) => {
        if (s.points.length === 0) return null;
        const line = s.points.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
        const area = `${line} L${x(s.points.length - 1).toFixed(1)},${y(0)} L${x(0)},${y(0)} Z`;
        const last = s.points.length - 1;
        return (
          <g key={s.user.id}>
            <path d={area} fill={`url(#fill-${s.user.id})`} className="fade-late" />
            <path d={line} pathLength={1} className="draw" fill="none" stroke={s.user.color} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={x(last)} cy={y(s.points[last])} r={5} fill={s.user.color} className="fade-late stroke-surface" strokeWidth={2.5} />
            <title>{`${s.user.name}: ${formatMoney(s.points[last])} do dnia ${last + 1}`}</title>
          </g>
        );
      })}
    </svg>
  );
}

/** Two bars per category, one per person, on a common scale. */
export function PairedBars({ rows, users }: {
  rows: { name: string; emoji: string; amounts: Record<string, number>; total: number }[];
  users: User[];
}) {
  const max = Math.max(1, ...rows.flatMap((r) => users.map((u) => r.amounts[u.id] ?? 0)));
  return (
    <ul className="space-y-4">
      {rows.map((row) => (
        <li key={row.name} className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,12rem)_1fr_6rem]">
          <span className="row-span-1 flex items-center gap-2 truncate text-sm sm:row-span-2">
            <span aria-hidden>{row.emoji}</span><span className="truncate">{row.name}</span>
          </span>
          <span className="hidden text-right text-sm font-medium tabular sm:order-last sm:row-span-2 sm:block">{formatMoney(row.total)}</span>
          <span className="col-span-2 space-y-1 sm:col-span-1">
            {users.map((u) => {
              const value = row.amounts[u.id] ?? 0;
              return (
                <span key={u.id} className="flex items-center gap-2" title={`${u.name}: ${formatMoney(value)}`}>
                  <span className="grow-x h-3 rounded-full" style={{ width: `max(${(value / max) * 100}%, ${value ? "4px" : "0px"})`, background: u.color }} />
                  <span className="shrink-0 text-xs text-fg-muted tabular">{value ? formatMoney(value) : "-"}</span>
                </span>
              );
            })}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Monthly totals as columns stacked by person. */
export function StackedMonths({ months, users, active, height = 180 }: {
  months: { month: string; amounts: Record<string, number>; total: number }[];
  users: User[];
  active: string;
  height?: number;
}) {
  const max = Math.max(1, ...months.map((m) => m.total));
  return (
    <div>
      <div className="flex items-end gap-2 sm:gap-3" style={{ height }}>
        {months.map((m) => (
          <div key={m.month} className="flex h-full flex-1 flex-col justify-end" title={`${formatMonth(m.month)}: ${formatMoney(m.total)}\n${users.map((u) => `${u.name}: ${formatMoney(m.amounts[u.id] ?? 0)}`).join("\n")}`}>
            <span className={`mb-1 text-center text-[10px] tabular ${m.month === active ? "font-medium text-fg" : "text-fg-muted"}`}>
              {m.total ? formatMoneyShort(m.total).replace(/\s?zł/, "") : ""}
            </span>
            <div className={`grow-y flex flex-col-reverse overflow-hidden rounded-xl ${m.month === active ? "" : "opacity-60"}`} style={{ height: `${(m.total / max) * 85}%`, ["--i" as string]: months.indexOf(m) * 4 }}>
              {users.map((u) => (
                <div key={u.id} style={{ height: m.total ? `${((m.amounts[u.id] ?? 0) / m.total) * 100}%` : 0, background: u.color }} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2 sm:gap-3">
        {months.map((m) => (
          <span key={m.month} className={`flex-1 text-center text-[11px] capitalize ${m.month === active ? "font-medium" : "text-fg-muted"}`}>{formatMonthShort(m.month)}</span>
        ))}
      </div>
    </div>
  );
}

export function Legend({ users }: { users: User[] }) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-fg-muted">
      {users.map((u) => (
        <span key={u.id} className="flex items-center gap-1.5">
          <Avatar user={u} size={18} /> {u.name}
        </span>
      ))}
    </div>
  );
}
