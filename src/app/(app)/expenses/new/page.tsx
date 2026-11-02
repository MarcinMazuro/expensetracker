import type { Metadata } from "next";
import Link from "next/link";
import { ExpenseForm } from "@/components/ExpenseForm";
import { Card, PageHeader } from "@/components/ui";
import { listCategories } from "@/lib/categories";
import { today } from "@/lib/dates";
import { recentSuggestions } from "@/lib/expenses";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Nowy wydatek" };

export default async function NewExpensePage() {
  const user = await requireUser();
  const [categories, suggestions] = await Promise.all([listCategories(user.id), recentSuggestions(user.id)]);

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Nowy wydatek" subtitle={<>Masz paragon? <Link href="/scan" className="text-accent hover:underline">Zeskanuj go</Link> - AI wpisze wszystko za Ciebie.</>} />
      <Card>
        <ExpenseForm categories={categories} today={today()} merchants={suggestions.merchants} tags={suggestions.tags} />
      </Card>
    </div>
  );
}
