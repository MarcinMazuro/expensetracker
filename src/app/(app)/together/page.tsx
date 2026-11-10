import type { Metadata } from "next";
import Link from "next/link";
import { settleAll, settleExpense } from "@/app/actions/expenses";
import { Animal } from "@/components/Animal";
import { Avatar } from "@/components/Avatar";
import { Legend, PairedBars, RaceChart, ShareBar, StackedMonths } from "@/components/charts/Shared";
import { ConfirmButton } from "@/components/ConfirmButton";
import { CountUp } from "@/components/CountUp";
import { MonthSwitcher } from "@/components/MonthSwitcher";
import { Card, CardTitle, ChangeBadge, EmptyState } from "@/components/ui";
import { speciesOf } from "@/lib/access";
import { currentMonth, daysInMonth, formatDayShort, formatMonth, inMonth, isIsoMonth, monthRange, monthsBack, shiftMonth, today } from "@/lib/dates";
import { listUnsettled } from "@/lib/expenses";
import { compareCategories, cumulativeByPerson, insights, monthlyByPerson, personTotals, settlement, sharedFeed } from "@/lib/household";
import { loadHousehold } from "@/lib/household-data";
import { formatMoney } from "@/lib/money";
import { bookDueRecurring, upcomingCharges } from "@/lib/recurring";
import { requireUser } from "@/lib/session";
import { change, pace } from "@/lib/stats";
import { plural } from "@/lib/text";
import { isHiddenNow } from "@/lib/visibility";

export const metadata: Metadata = { title: "Razem" };

const badge = "shrink-0 rounded-full bg-accent-soft px-1.5 py-px text-[10px] font-medium text-accent";

export default async function TogetherPage({ searchParams }: PageProps<"/together">) {
  const user = await requireUser();
  const { month: monthParam } = await searchParams;
  const month = isIsoMonth(monthParam) ? monthParam : currentMonth();
  const months = monthsBack(month, 6);
  const now = today();

  await bookDueRecurring(user.id);
  const members = await loadHousehold(user.id, monthRange(months[0]).from, monthRange(month).to);
  // The signed-in person first, so "you" are always on the left
  members.sort((a, b) => (a.user.id === user.id ? -1 : b.user.id === user.id ? 1 : 0));
  const users = members.map((m) => m.user);

  const people = personTotals(members, month, now);
  const combined = people.reduce((s, p) => s + p.total, 0);
  const previous = people.reduce((s, p) => s + p.previous, 0);
  const categories = compareCategories(members, month);
  const feed = sharedFeed(members, month);
  const notes = insights(members, month, now);
  const isCurrent = month === currentMonth();
  // Each person's forecast, recurring charges counted once rather than extrapolated
  const [upcoming, unsettled] = await Promise.all([
    Promise.all(members.map((m) => upcomingCharges(m.user.id, month))),
    // Debts do not end with the month: everything not paid back yet, whenever it was
    Promise.all(users.map(async (u) => ({ user: u, expenses: await listUnsettled(u.id) }))),
  ]);
  const dailyAverage = members.reduce((sum, m, i) => sum + pace(m.expenses, month, now, upcoming[i]).dailyAverage, 0);
  const owed = settlement(unsettled, users);
  const [left, right] = users.map((u) => ({ user: u, species: speciesOf(u.avatar) }));

  return (
    <div className="stagger space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-fg-muted">{users.map((u) => u.name).join(" i ")}</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Razem</h1>
        </div>
        <MonthSwitcher month={month} path="/together" />
      </header>

      {/* The scene: the two of you walking towards each other, the month's total above */}
      <section className="relative overflow-hidden rounded-[2rem] border border-line/80 bg-surface shadow-card">
        <div aria-hidden className="pointer-events-none absolute inset-0"
          style={{ background: `radial-gradient(70% 90% at 0% 100%, color-mix(in oklab, ${users[0]?.color ?? "#0d9488"} 26%, transparent), transparent 62%), radial-gradient(70% 90% at 100% 100%, color-mix(in oklab, ${users[1]?.color ?? "#e11d48"} 26%, transparent), transparent 62%)` }} />
        <div className="relative px-5 pt-6 text-center sm:pt-8">
          <p className="text-sm text-fg-muted">Wspólnie {inMonth(month)}</p>
          <p className="mt-1 font-display text-5xl leading-none font-semibold tracking-tight tabular sm:text-6xl"><CountUp value={combined} /></p>
          <p className="mt-2 flex flex-wrap items-center justify-center gap-x-3 text-sm text-fg-muted tabular">
            <ChangeBadge value={change(combined, previous)} label={isCurrent ? "vs ten sam okres m-c temu" : `vs ${formatMonth(shiftMonth(month, -1))}`} />
            <span>średnio {formatMoney(dailyAverage)} dziennie</span>
          </p>
        </div>

        <div className="relative mt-1 flex h-32 items-end justify-between px-2 sm:h-40 sm:px-10">
          <div aria-hidden className="pointer-events-none absolute inset-x-6 bottom-[-1.4rem] h-10 rounded-[50%] bg-black/25 blur-xl" />
          {left?.species && (
            <div className="h-full w-[44%] sm:w-[36%]" style={{ animation: "walk-in-left 1s cubic-bezier(0.2, 0.9, 0.25, 1) both" }}>
              <Animal species={left.species} pose="walk" flip className="not-christmas size-full" />
              <Animal species={left.species} pose="stand" flip className="only-christmas size-full" />
            </div>
          )}
          <span aria-hidden className="mb-10 animate-pop text-3xl [animation-delay:900ms] sm:text-4xl">💞</span>
          {right?.species && (
            <div className="h-full w-[44%] animate-walk-in sm:w-[36%]">
              <Animal species={right.species} pose="walk" className="not-christmas size-full" />
              <Animal species={right.species} pose="stand" className="only-christmas size-full" />
            </div>
          )}
        </div>

        <div className="relative space-y-3 bg-surface/70 p-4 backdrop-blur-sm sm:p-5">
          <ShareBar people={people} />
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {people.map((p, i) => (
              <Link key={p.user.id} href={`/expenses?month=${month}${p.user.id === user.id ? "" : `&u=${p.user.id}`}`}
                className={`flex items-center gap-2.5 rounded-2xl bg-surface-muted/70 p-2.5 transition active:scale-[0.97] ${i === 1 ? "flex-row-reverse text-right" : ""}`}>
                <Avatar user={p.user} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-fg-muted">{p.user.id === user.id ? "Ty" : p.user.name}, {Math.round(p.share * 100)}%</p>
                  <p className="font-display text-lg leading-tight font-semibold tabular">{formatMoney(p.total)}</p>
                  <p className="text-[11px] text-fg-muted">{plural(p.count, "wydatek", "wydatki", "wydatków")}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Who owes whom - all time, until someone taps "Oddane" */}
      <Card className="relative overflow-hidden">
        <CardTitle>Do oddania</CardTitle>
        {owed.debts.length === 0 ? (
          <div className="flex items-center gap-4">
            <Animal species="puma" pose="lick" className="h-20 w-24 shrink-0 animate-rise" />
            <p className="text-sm">
              <span className="block font-display text-lg font-semibold">Jesteście rozliczeni</span>
              <span className="text-fg-muted">
                {owed.lines.length > 0 ? "Długi w obie strony się znoszą." : "Zaznacz „Wspólny wydatek” przy dodawaniu, a tu pojawi się, kto komu ile oddaje."}
              </span>
            </p>
          </div>
        ) : (
          owed.debts.map((d) => {
            const from = users.find((u) => u.id === d.from)!;
            const to = users.find((u) => u.id === d.to)!;
            return (
              <div key={`${d.from}-${d.to}`} className="flex items-center gap-3">
                <Avatar user={from} size={56} />
                <div className="min-w-0 flex-1 text-center">
                  <p className="font-display text-3xl leading-none font-semibold tabular"><CountUp value={d.amount} /></p>
                  <div className="relative mx-2 my-2 h-1 rounded-full" style={{ background: `linear-gradient(90deg, ${from.color}, ${to.color})` }}>
                    <span className="absolute -top-[9px] -right-1.5 text-base" style={{ color: to.color }} aria-hidden>▶</span>
                  </div>
                  <p className="text-xs text-fg-muted">{from.name} → {to.name}</p>
                </div>
                <Avatar user={to} size={56} />
              </div>
            );
          })
        )}

        {owed.lines.length > 0 && (
          <>
            <details className="group mt-4 border-t border-line pt-3">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">
                {plural(owed.lines.length, "wspólny wydatek", "wspólne wydatki", "wspólnych wydatków")} do rozliczenia
                <span className="text-fg-muted transition-transform duration-300 group-open:rotate-180" aria-hidden>▾</span>
              </summary>
              <ul className="mt-2 divide-y divide-line">
                {owed.lines.map((line) => (
                  <li key={`${line.from.id}-${line.id}`} className="flex items-center gap-3 py-2.5">
                    <Avatar user={line.from} size={28} />
                    <Link href={`/expenses/${line.id}${line.from.id === user.id ? "" : `?u=${line.from.id}`}`} className="min-w-0 flex-1 text-sm">
                      <span className="block truncate font-medium">{line.merchant}</span>
                      <span className="block text-xs text-fg-muted tabular">{formatDayShort(line.date)}, {formatMoney(line.amountPln)} dla: {line.to.name}</span>
                    </Link>
                    <form action={settleExpense}>
                      <input type="hidden" name="id" value={line.id} />
                      <input type="hidden" name="owner" value={line.from.id} />
                      <button name="settled" value="on" className="rounded-full border border-accent px-3 py-1.5 text-xs font-medium text-accent transition active:scale-90">Oddane</button>
                    </form>
                  </li>
                ))}
              </ul>
            </details>
            <form action={settleAll} className="mt-3">
              <ConfirmButton variant="primary" message="Oznaczyć wszystkie wspólne wydatki jako oddane?">Wszystko oddane</ConfirmButton>
            </form>
          </>
        )}
      </Card>

      {combined === 0 ? (
        <EmptyState title="W tym miesiącu nikt jeszcze nic nie wydał" />
      ) : (
        <>
          <Card>
            <CardTitle action={<Legend users={users} />}>Wyścig miesiąca</CardTitle>
            <RaceChart series={cumulativeByPerson(members, month, now)} days={daysInMonth(month)} />
            <p className="mt-1 text-xs text-fg-muted">Wydatki narastająco, dzień po dniu.</p>
          </Card>

          <Card>
            <CardTitle>W skrócie</CardTitle>
            <ul className="space-y-3">
              {notes.map((n) => (
                <li key={n.text} className="flex gap-3 text-sm">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-surface-muted text-base" aria-hidden>{n.emoji}</span>
                  <span className="pt-1.5">{n.text}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardTitle action={<Legend users={users} />}>Kto ile na co</CardTitle>
            <PairedBars rows={categories.slice(0, 10)} users={users} />
          </Card>

          <div className="grid gap-3 lg:grid-cols-5">
            <Card className="lg:col-span-2">
              <CardTitle>Ostatnie 6 miesięcy</CardTitle>
              <StackedMonths months={monthlyByPerson(members, months)} users={users} active={month} />
            </Card>
            <Card className="px-3 lg:col-span-3">
              <CardTitle><span className="px-2">Ostatnie wydatki</span></CardTitle>
              <ul className="divide-y divide-line">
                {feed.map(({ users: owners, paidBy, expense, category, amountPln }) => {
                  // Everything opens for viewing and editing - your copy of a shared one, else the owner's
                  const owner = owners.some((o) => o.id === user.id) ? user : owners[0];
                  return (
                    <li key={`${owners[0].id}-${expense.id}`}>
                      <Link href={`/expenses/${expense.id}${owner.id === user.id ? "" : `?u=${owner.id}`}`}
                        className="flex items-center gap-3 rounded-2xl px-2 py-2.5 transition active:scale-[0.98] active:bg-surface-muted">
                        <span className="relative">
                          <span className="flex size-11 items-center justify-center rounded-2xl text-lg"
                            style={{ background: `color-mix(in oklab, ${category?.color ?? "#a8a29e"} 18%, transparent)` }} aria-hidden>
                            {category?.emoji ?? "❔"}
                          </span>
                          <span className="absolute -right-2 -bottom-1 flex -space-x-1.5">
                            {owners.map((o) => <Avatar key={o.id} user={o} size={18} ring />)}
                          </span>
                        </span>
                        <span className="min-w-0 flex-1 pl-1">
                          <span className="flex items-center gap-1.5 text-sm font-medium">
                            <span className="truncate">{expense.merchant}</span>
                            {expense.shared && <span className={badge}>{expense.shared.settled ? "oddane" : "wspólny"}</span>}
                            {isHiddenNow(expense) && <span className={badge}>🤫</span>}
                          </span>
                          <span className="block truncate text-xs text-fg-muted">
                            {expense.shared ? `płacił(a) ${paidBy.name}` : paidBy.name}, {category?.name ?? "Bez kategorii"}, {formatDayShort(expense.date)}
                          </span>
                        </span>
                        <span className="text-sm font-medium tabular">{formatMoney(amountPln)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
