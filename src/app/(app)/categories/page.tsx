import type { Metadata } from "next";
import { Card, CardTitle, PageHeader } from "@/components/ui";
import { CATEGORY_COLORS, listCategories } from "@/lib/categories";
import { currentMonth, monthRange } from "@/lib/dates";
import { listExpenses } from "@/lib/expenses";
import { formatMoney } from "@/lib/money";
import { requireUser } from "@/lib/session";
import { byCategory } from "@/lib/stats";
import { CategoryEditor } from "./CategoryEditor";

export const metadata: Metadata = { title: "Kategorie i budżety" };

export default async function CategoriesPage() {
  const user = await requireUser();
  const { from, to } = monthRange(currentMonth());
  const [categories, expenses] = await Promise.all([listCategories(user.id), listExpenses(user.id, from, to)]);
  const spent = new Map(byCategory(expenses).map((c) => [c.categoryId, c.total]));
  const budgetTotal = categories.reduce((s, c) => s + c.budget, 0);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Kategorie i budżety"
        subtitle={budgetTotal ? `Suma budżetów: ${formatMoney(budgetTotal)} miesięcznie` : "Ustaw miesięczny budżet przy kategoriach, które chcesz pilnować."} />
      <Card className="px-3">
        <div className="divide-y divide-line">
          {categories.map((c) => (
            <CategoryEditor key={c.id} category={c} categories={categories} colors={CATEGORY_COLORS} spent={spent.get(c.id)} />
          ))}
        </div>
      </Card>
      <Card className="mt-4">
        <CardTitle>Nowa kategoria</CardTitle>
        <CategoryEditor categories={categories} colors={CATEGORY_COLORS} />
      </Card>
    </div>
  );
}
