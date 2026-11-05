import type { Metadata } from "next";
import { Avatar } from "@/components/Avatar";
import { AVATARS, isAvatarId, type AvatarId } from "@/lib/access";
import { Legend, PairedBars, RaceChart, ShareBar, StackedMonths } from "@/components/charts/Shared";
import { MonthSwitcher } from "@/components/MonthSwitcher";
import { Card, CardTitle, ChangeBadge, EmptyState } from "@/components/ui";
import { currentMonth, daysInMonth, formatDayShort, formatMonth, inMonth, isIsoMonth, monthRange, monthsBack, shiftMonth, today } from "@/lib/dates";
import { compareCategories, cumulativeByPerson, insights, monthlyByPerson, personTotals, sharedFeed } from "@/lib/household";
import { loadHousehold } from "@/lib/household-data";
import { formatMoney } from "@/lib/money";
import { bookDueRecurring } from "@/lib/recurring";
import { requireUser } from "@/lib/session";
import { change } from "@/lib/stats";

export const metadata: Metadata = { title: "Razem" };

export default async function TogetherPage({ searchParams }: PageProps<"/together">) {
  const user = await requireUser();
  const { month: monthParam } = await searchParams;
  const month = isIsoMonth(monthParam) ? monthParam : currentMonth();
  const months = monthsBack(month, 6);
  const now = today();

  await bookDueRecurring(user.id);
  const members = await loadHousehold(monthRange(months[0]).from, monthRange(month).to);
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
  const elapsed = isCurrent ? Number(now.slice(8, 10)) : daysInMonth(month);

  return (
    <>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {users.map((u) => <Avatar key={u.id} user={u} size={40} ring />)}
          </div>
          <div>
            <p className="text-sm text-fg-muted">{users.map((u) => u.name).join(" i ")}</p>
            <h1 className="text-2xl font-semibold tracking-tight">Razem</h1>
          </div>
        </div>
        <MonthSwitcher month={month} path="/together" />
      </header>

      {/* Hero: the combined total and who contributed what */}
      <section className="relative overflow-hidden rounded-3xl border border-line bg-surface p-6 sm:p-8">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60"
          style={{ background: `radial-gradient(60% 120% at 0% 0%, ${users[0]?.color ?? "#0d9488"}22, transparent 60%), radial-gradient(60% 120% at 100% 100%, ${users[1]?.color ?? "#e11d48"}22, transparent 60%)` }} />
        {/* The two of you, standing at the right edge of the card */}
        <div aria-hidden className="pointer-events-none absolute right-2 bottom-0 hidden items-end gap-1 sm:flex lg:right-8">
          {users.filter((u) => isAvatarId(u.avatar)).map((u, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={u.id} src={AVATARS[u.avatar as AvatarId].full} alt="" className={i === 0 ? "h-52 lg:h-60" : "h-44 lg:h-52"}
              style={{ filter: "drop-shadow(0 12px 18px rgb(0 0 0 / 0.25))" }} />
          ))}
        </div>
        <div className="relative sm:pr-72 lg:pr-96">
          <p className="text-sm text-fg-muted">Wspólnie {inMonth(month)}</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <p className="text-4xl font-semibold tracking-tight tabular sm:text-5xl">{formatMoney(combined)}</p>
            <ChangeBadge value={change(combined, previous)} label={isCurrent ? "vs ten sam okres m-c temu" : `vs ${formatMonth(shiftMonth(month, -1))}`} />
          </div>
          <p className="mt-1 text-sm text-fg-muted tabular">
            średnio {formatMoney(elapsed ? Math.round(combined / elapsed) : 0)} dziennie na was dwoje
          </p>

          <div className="mt-6"><ShareBar people={people} /></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {people.map((p) => (
              <div key={p.user.id} className="flex items-center gap-3 rounded-2xl bg-surface-muted/70 p-3">
                <Avatar user={p.user} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.user.id === user.id ? `${p.user.name} (Ty)` : p.user.name}</p>
                  <p className="text-xs text-fg-muted">{p.count} wydatków · <ChangeBadge value={change(p.total, p.previous)} /></p>
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular">{formatMoney(p.total)}</p>
                  <p className="text-xs text-fg-muted tabular">{Math.round(p.share * 100)}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {combined === 0 ? (
        <div className="mt-3"><EmptyState title="W tym miesiącu nikt jeszcze nic nie wydał" /></div>
      ) : (
        <>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardTitle action={<Legend users={users} />}>Wyścig miesiąca - wydatki narastająco</CardTitle>
              <RaceChart series={cumulativeByPerson(members, month, now)} days={daysInMonth(month)} />
            </Card>
            <Card>
              <CardTitle>W skrócie</CardTitle>
              <ul className="space-y-3">
                {notes.map((n) => (
                  <li key={n.text} className="flex gap-3 text-sm">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-surface-muted" aria-hidden>{n.emoji}</span>
                    <span className="pt-1">{n.text}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card className="mt-3">
            <CardTitle action={<Legend users={users} />}>Kto ile na co</CardTitle>
            <PairedBars rows={categories.slice(0, 10)} users={users} />
          </Card>

          <div className="mt-3 grid gap-3 lg:grid-cols-5">
            <Card className="lg:col-span-2">
              <CardTitle>Ostatnie 6 miesięcy</CardTitle>
              <StackedMonths months={monthlyByPerson(members, months)} users={users} active={month} />
            </Card>
            <Card className="px-3 lg:col-span-3">
              <CardTitle><span className="px-2">Ostatnie wydatki</span></CardTitle>
              <ul className="divide-y divide-line">
                {feed.map(({ user: owner, expense, category }) => (
                  <li key={`${owner.id}-${expense.id}`} className="flex items-center gap-3 px-2 py-2.5">
                    <span className="relative">
                      <span className="flex size-10 items-center justify-center rounded-xl text-lg"
                        style={{ background: `color-mix(in oklab, ${category?.color ?? "#a8a29e"} 18%, transparent)` }} aria-hidden>
                        {category?.emoji ?? "❔"}
                      </span>
                      <Avatar user={owner} size={18} ring className="absolute -right-1 -bottom-1" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{expense.merchant}</span>
                      <span className="block truncate text-xs text-fg-muted">{owner.name} · {category?.name ?? "Bez kategorii"} · {formatDayShort(expense.date)}</span>
                    </span>
                    <span className="text-sm font-medium tabular">{formatMoney(expense.amountPln)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
