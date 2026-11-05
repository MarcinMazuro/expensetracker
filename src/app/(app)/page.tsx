import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { BarChart } from "@/components/charts/BarChart";
import { ShareBar } from "@/components/charts/Shared";
import { Donut } from "@/components/charts/Donut";
import { Progress } from "@/components/charts/Progress";
import { ExpenseRow } from "@/components/ExpenseRow";
import { MonthSwitcher } from "@/components/MonthSwitcher";
import { NavIcon } from "@/components/Navigation";
import { Card, CardTitle, CategoryDot, ChangeBadge, EmptyState, LinkButton } from "@/components/ui";
import { categoryMap, listCategories, UNKNOWN_CATEGORY } from "@/lib/categories";
import { currentMonth, inMonth, isIsoMonth, monthRange, shiftMonth, today } from "@/lib/dates";
import { listExpenses } from "@/lib/expenses";
import { personTotals } from "@/lib/household";
import { loadHousehold } from "@/lib/household-data";
import { formatMoney } from "@/lib/money";
import { bookDueRecurring } from "@/lib/recurring";
import { requireUser } from "@/lib/session";
import { budgets, byCategory, change, dailySeries, pace, topMerchants, total } from "@/lib/stats";

export default async function Dashboard({ searchParams }: PageProps<"/">) {
  const user = await requireUser();
  const { month: monthParam } = await searchParams;
  const month = isIsoMonth(monthParam) ? monthParam : currentMonth();
  const previousMonth = shiftMonth(month, -1);
  const now = today();

  await bookDueRecurring(user.id);
  const [categories, expenses, members] = await Promise.all([
    listCategories(user.id),
    listExpenses(user.id, monthRange(previousMonth).from, monthRange(month).to),
    loadHousehold(monthRange(month).from, monthRange(month).to),
  ]);
  members.sort((a, b) => (a.user.id === user.id ? -1 : b.user.id === user.id ? 1 : 0));
  const household = personTotals(members, month, now);
  const categoriesById = categoryMap(categories);
  const category = (id: string) => categoriesById.get(id) ?? UNKNOWN_CATEGORY;

  const thisMonth = expenses.filter((e) => e.date.startsWith(month));
  const lastMonth = expenses.filter((e) => e.date.startsWith(previousMonth));
  const stats = pace(thisMonth, month, now);
  // Compare like with like: the 1st-15th of this month against the 1st-15th of the last one
  const sameDayLastMonth = `${previousMonth}-${String(stats.elapsedDays).padStart(2, "0")}`;
  const lastMonthToDate = total(lastMonth.filter((e) => e.date <= sameDayLastMonth));
  const budgetList = budgets(categories, thisMonth, month, now);
  const budgetTotal = categories.reduce((s, c) => s + c.budget, 0);
  const shares = byCategory(thisMonth);
  const daily = dailySeries(thisMonth, month);
  const isCurrentMonth = month === currentMonth();

  return (
    <>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-fg-muted">Cześć, {user.name.split(" ")[0]}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Twoje wydatki</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MonthSwitcher month={month} path="/" />
          <LinkButton href="/scan" variant="secondary" className="hidden sm:inline-flex">
            <NavIcon name="scan" className="size-4" /> Skanuj paragon
          </LinkButton>
          <LinkButton href="/expenses/new" className="lg:hidden">+ Dodaj</LinkButton>
        </div>
      </header>

      {household.length > 1 && (
        <Link href={`/together?month=${month}`}
          className="group mb-3 flex items-center gap-4 rounded-2xl border border-line bg-surface px-5 py-3.5 transition hover:border-accent">
          <span className="flex -space-x-2">{household.map((p) => <Avatar key={p.user.id} user={p.user} size={34} ring />)}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-fg-muted">Razem {inMonth(month)}</span>
            <span className="block font-semibold tabular">{formatMoney(household.reduce((s, p) => s + p.total, 0))}</span>
          </span>
          <span className="hidden w-48 sm:block"><ShareBar people={household} /></span>
          <span className="text-fg-muted transition group-hover:translate-x-0.5 group-hover:text-accent">→</span>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="col-span-2 lg:col-span-1">
          <p className="text-sm text-fg-muted">Wydano</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight tabular">{formatMoney(stats.spent)}</p>
          <p className="mt-2">
            <ChangeBadge value={change(stats.spent, isCurrentMonth ? lastMonthToDate : total(lastMonth))}
              label={isCurrentMonth ? "vs ten sam okres m-c temu" : "vs poprzedni miesiąc"} />
          </p>
        </Card>
        <Card>
          <p className="text-sm text-fg-muted">Średnio dziennie</p>
          <p className="mt-1 text-xl font-semibold tabular">{formatMoney(stats.dailyAverage)}</p>
          <p className="mt-2 text-xs text-fg-muted">{thisMonth.length} wydatków</p>
        </Card>
        <Card>
          <p className="text-sm text-fg-muted">{isCurrentMonth ? "Prognoza na koniec" : "Poprzedni miesiąc"}</p>
          <p className="mt-1 text-xl font-semibold tabular">{formatMoney(isCurrentMonth ? stats.projected : total(lastMonth))}</p>
          <p className="mt-2 text-xs text-fg-muted">
            {isCurrentMonth ? `po ${stats.elapsedDays} z ${stats.days} dni` : `${lastMonth.length} wydatków`}
          </p>
        </Card>
        <Card className="col-span-2 lg:col-span-1">
          <p className="text-sm text-fg-muted">Budżet miesięczny</p>
          {budgetTotal > 0 ? (
            <>
              <p className="mt-1 text-xl font-semibold tabular">
                {budgetTotal - stats.spent >= 0 ? `zostało ${formatMoney(budgetTotal - stats.spent)}` : `ponad o ${formatMoney(stats.spent - budgetTotal)}`}
              </p>
              <div className="mt-3">
                <Progress ratio={stats.spent / budgetTotal} projectedRatio={stats.projected / budgetTotal}
                  state={stats.spent > budgetTotal ? "over" : stats.projected > budgetTotal ? "warning" : "ok"} />
              </div>
            </>
          ) : (
            <Link href="/categories" className="mt-2 block text-sm text-accent hover:underline">Ustaw budżety kategorii →</Link>
          )}
        </Card>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle>Dzień po dniu</CardTitle>
          <BarChart
            bars={daily.map((d) => ({ key: d.date, label: String(Number(d.date.slice(8))), value: d.total, active: d.date === now }))}
            labelEvery={daily.length > 20 ? 5 : 1}
            average={stats.dailyAverage}
          />
          <p className="mt-2 text-xs text-fg-muted">Linia przerywana: średnia dzienna.</p>
        </Card>
        <Card>
          <CardTitle>Na co idą pieniądze</CardTitle>
          {shares.length === 0 ? (
            <p className="text-sm text-fg-muted">Brak wydatków w tym miesiącu.</p>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <Donut centerLabel="razem" slices={shares.map((s) => ({ key: s.categoryId, label: category(s.categoryId).name, value: s.total, color: category(s.categoryId).color }))} />
              <ul className="w-full space-y-1.5 text-sm">
                {shares.slice(0, 6).map((s) => (
                  <li key={s.categoryId}>
                    <Link href={`/expenses?month=${month}&category=${s.categoryId}`} className="flex items-center gap-2 hover:underline">
                      <CategoryDot color={category(s.categoryId).color} />
                      <span className="flex-1 truncate">{category(s.categoryId).name}</span>
                      <span className="text-fg-muted tabular">{Math.round(s.share * 100)}%</span>
                      <span className="w-24 text-right tabular">{formatMoney(s.total)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card>
          <CardTitle action={<Link href="/categories" className="text-xs text-accent hover:underline">Edytuj</Link>}>Budżety</CardTitle>
          {budgetList.length === 0 ? (
            <p className="text-sm text-fg-muted">Ustaw miesięczne limity dla kategorii, a tutaj zobaczysz, ile zostało i czy zmieścisz się do końca miesiąca.</p>
          ) : (
            <ul className="space-y-4">
              {budgetList.map((b) => (
                <li key={b.category.id}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate">{b.category.emoji} {b.category.name}</span>
                    <span className="shrink-0 tabular">
                      {formatMoney(b.spent)} <span className="text-fg-muted">/ {formatMoney(b.budget)}</span>
                    </span>
                  </div>
                  <Progress ratio={b.ratio} projectedRatio={isCurrentMonth ? b.projected / b.budget : undefined} state={b.state} />
                  {b.state !== "ok" && (
                    <p className={b.state === "over" ? "mt-1 text-xs text-danger" : "mt-1 text-xs text-warning"}>
                      {b.state === "over"
                        ? `Przekroczony o ${formatMoney(b.spent - b.budget)}`
                        : isCurrentMonth && b.projected > b.budget
                          ? `W tym tempie: ${formatMoney(b.projected)} na koniec miesiąca`
                          : `Wykorzystano ${Math.round(b.ratio * 100)}%`}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardTitle>Gdzie wydajesz najwięcej</CardTitle>
          {thisMonth.length === 0 ? (
            <p className="text-sm text-fg-muted">Brak wydatków w tym miesiącu.</p>
          ) : (
            <ol className="space-y-3">
              {topMerchants(thisMonth).map((m, i) => (
                <li key={m.merchant} className="flex items-center gap-3 text-sm">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-surface-muted text-xs font-medium">{i + 1}</span>
                  <span className="flex-1 truncate">
                    {m.merchant} <span className="text-fg-muted">· {m.count}×</span>
                  </span>
                  <span className="tabular">{formatMoney(m.total)}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <Card className="mt-3">
        <CardTitle action={<Link href={`/expenses?month=${month}`} className="text-xs text-accent hover:underline">Wszystkie →</Link>}>
          Ostatnie wydatki
        </CardTitle>
        {thisMonth.length === 0 ? (
          <EmptyState title="Jeszcze nic tu nie ma">
            Zeskanuj paragon albo <Link href="/expenses/new" className="text-accent hover:underline">dodaj wydatek ręcznie</Link>.
          </EmptyState>
        ) : (
          <div className="-mx-2">
            {thisMonth.slice(0, 6).map((e) => <ExpenseRow key={e.id} expense={e} category={category(e.categoryId)} showDate />)}
          </div>
        )}
      </Card>
    </>
  );
}
