"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { saveExpense, suggestCategoryFor } from "@/app/actions/expenses";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { CURRENCIES, toInputValue } from "@/lib/money";
import type { Category, Expense } from "@/lib/types";

export function ExpenseForm({
  categories,
  expense,
  today,
  merchants,
  tags,
}: {
  categories: Category[];
  expense?: Expense;
  today: string;
  merchants: string[];
  tags: string[];
}) {
  const [state, action, pending] = useActionState(saveExpense, undefined);
  const [categoryId, setCategoryId] = useState(expense?.categoryId ?? "");
  // Once the user picks a category by hand, suggestions never overwrite it
  const touched = useRef(Boolean(expense));
  const [hint, setHint] = useState<string | null>(null);
  const [suggesting, startSuggest] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function suggest(force = false) {
    const form = formRef.current;
    if (!form || (touched.current && !force)) return;
    const merchant = (form.elements.namedItem("merchant") as HTMLInputElement).value;
    const note = (form.elements.namedItem("note") as HTMLTextAreaElement).value;
    if (merchant.trim().length < 2) return;

    startSuggest(async () => {
      const result = await suggestCategoryFor(merchant, note);
      if (!result.categoryId) {
        setHint(force ? "Brak podpowiedzi - wybierz ręcznie." : null);
        return;
      }
      setCategoryId(result.categoryId);
      setHint(result.source === "memory" ? "Tak jak ostatnio u tego sprzedawcy" : "Podpowiedź AI - zmień, jeśli nie pasuje");
    });
  }

  return (
    <form ref={formRef} action={action} className="space-y-5"
      // Reset after "save and add another" without losing date and currency
      key={state?.success}>
      {expense && <input type="hidden" name="id" value={expense.id} />}

      <div className="grid grid-cols-[1fr_6.5rem] gap-3">
        <Field label="Kwota">
          <input name="amount" inputMode="decimal" required autoFocus={!expense} placeholder="0,00"
            defaultValue={expense ? toInputValue(expense.amount) : ""} autoComplete="off"
            className={`${inputClass} h-12 text-xl font-semibold tabular`} />
        </Field>
        <Field label="Waluta">
          <select name="currency" defaultValue={expense?.currency ?? "PLN"} className={`${inputClass} h-12`}>
            {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Gdzie / na co" hint="Np. Biedronka, Orlen, fryzjer, prezent dla mamy">
        <input name="merchant" required maxLength={120} list="merchant-list" defaultValue={expense?.merchant}
          onBlur={() => suggest()} autoComplete="off" className={inputClass} />
        <datalist id="merchant-list">{merchants.map((m) => <option key={m} value={m} />)}</datalist>
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Kategoria" hint={suggesting ? "Szukam pasującej kategorii..." : hint ?? undefined}>
          <div className="flex gap-2">
            <select name="categoryId" required value={categoryId}
              onChange={(e) => { touched.current = true; setHint(null); setCategoryId(e.target.value); }}
              className={inputClass}>
              <option value="" disabled>Wybierz...</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
            </select>
            <Button type="button" variant="secondary" onClick={() => suggest(true)} disabled={suggesting}
              title="Podpowiedz kategorię (AI)" aria-label="Podpowiedz kategorię" className="px-3">✨</Button>
          </div>
        </Field>
        <Field label="Data">
          <input name="date" type="date" required max={today} defaultValue={expense?.date ?? today} className={inputClass} />
        </Field>
      </div>

      <Field label="Tagi" hint="Po przecinku, np. wakacje, auto">
        <input name="tags" list="tag-list" defaultValue={expense?.tags.join(", ")} autoComplete="off" className={inputClass} />
        <datalist id="tag-list">{tags.map((t) => <option key={t} value={t} />)}</datalist>
      </Field>

      <Field label="Notatka">
        <textarea name="note" rows={2} maxLength={1000} defaultValue={expense?.note} className={`${inputClass} h-auto py-2`} />
      </Field>

      {state?.error && <Alert>{state.error}</Alert>}
      {state?.success && <Alert tone="success">{state.success}</Alert>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending} className="flex-1 sm:flex-none">{pending ? "Zapisywanie..." : "Zapisz"}</Button>
        {!expense && (
          <Button type="submit" name="intent" value="another" variant="secondary" disabled={pending}>
            Zapisz i dodaj kolejny
          </Button>
        )}
      </div>
    </form>
  );
}
