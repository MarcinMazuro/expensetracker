"use client";

import { useActionState, useState } from "react";
import { deleteCategory, moveCategory, saveCategory } from "@/app/actions/categories";
import { Alert, Button, inputClass } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatMoney, toInputValue } from "@/lib/money";
import type { Category } from "@/lib/types";

export function CategoryEditor({ category, categories, colors, spent }: {
  category?: Category;
  categories: Category[];
  colors: string[];
  spent?: number;
}) {
  const [open, setOpen] = useState(!category);
  const [state, action, pending] = useActionState(saveCategory, undefined);
  const [deleteState, deleteAction, deleting] = useActionState(deleteCategory, undefined);
  const [color, setColor] = useState(category?.color ?? colors[0]);

  if (category && !open) {
    return (
      <div className="flex items-center gap-3 px-2 py-2.5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl text-lg"
          style={{ background: `color-mix(in oklab, ${category.color} 18%, transparent)` }}>{category.emoji}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{category.name}</span>
          <span className="block text-xs text-fg-muted tabular">
            {category.budget ? `budżet ${formatMoney(category.budget)} / mies.` : "bez budżetu"}
            {spent ? ` · w tym miesiącu ${formatMoney(spent)}` : ""}
          </span>
        </span>
        <form action={moveCategory} className="hidden sm:flex">
          <input type="hidden" name="id" value={category.id} />
          <button name="direction" value="up" className="px-2 text-fg-muted hover:text-fg" aria-label="W górę">↑</button>
          <button name="direction" value="down" className="px-2 text-fg-muted hover:text-fg" aria-label="W dół">↓</button>
        </form>
        <Button variant="ghost" onClick={() => setOpen(true)}>Edytuj</Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-surface-muted/60 p-3">
      <form action={action} className="grid gap-2 sm:grid-cols-[4rem_1fr_9rem]">
        {category && <input type="hidden" name="id" value={category.id} />}
        <input type="hidden" name="color" value={color} />
        <input name="emoji" defaultValue={category?.emoji ?? "📦"} maxLength={8} aria-label="Emoji" className={cn(inputClass, "text-center text-lg")} />
        <input name="name" defaultValue={category?.name} placeholder="Nazwa kategorii" required maxLength={40} aria-label="Nazwa" className={inputClass} />
        <input name="budget" defaultValue={category?.budget ? toInputValue(category.budget) : ""} placeholder="Budżet / mies." inputMode="decimal"
          aria-label="Miesięczny budżet w zł" className={cn(inputClass, "tabular")} />
        <div className="flex flex-wrap gap-1.5 sm:col-span-3" role="radiogroup" aria-label="Kolor">
          {colors.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={c === color} aria-label={c} onClick={() => setColor(c)}
              className={cn("size-7 rounded-full transition", c === color && "ring-2 ring-fg ring-offset-2 ring-offset-surface")} style={{ background: c }} />
          ))}
        </div>
        {state?.error && <div className="sm:col-span-3"><Alert>{state.error}</Alert></div>}
        {state?.success && <div className="sm:col-span-3"><Alert tone="success">{state.success}</Alert></div>}
        <div className="flex gap-2 sm:col-span-3">
          <Button type="submit" disabled={pending}>{category ? "Zapisz" : "Dodaj kategorię"}</Button>
          {category && <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Zamknij</Button>}
        </div>
      </form>

      {category && (
        <form action={deleteAction} className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-sm">
          <input type="hidden" name="id" value={category.id} />
          <span className="text-fg-muted">Usuń i przenieś wydatki do:</span>
          <select name="target" required defaultValue="" className={cn(inputClass, "h-9 w-auto")}>
            <option value="" disabled>wybierz...</option>
            {categories.filter((c) => c.id !== category.id).map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
          </select>
          <Button variant="danger" type="submit" disabled={deleting} className="h-9">Usuń</Button>
          {deleteState?.error && <Alert>{deleteState.error}</Alert>}
        </form>
      )}
    </div>
  );
}
