"use client";

import { useActionState } from "react";
import { saveRecurring } from "@/app/actions/recurring";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { CURRENCIES } from "@/lib/money";
import type { Category } from "@/lib/types";
import { INTERVALS } from "@/lib/validation";

export function RecurringForm({ categories, today }: { categories: Category[]; today: string }) {
  const [state, action, pending] = useActionState(saveRecurring, undefined);
  const subscriptions = categories.find((c) => c.name === "Subskrypcje")?.id ?? "";

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2" key={state?.success}>
      <Field label="Nazwa" className="sm:col-span-2">
        <input name="name" required maxLength={80} placeholder="Netflix, czynsz, siłownia..." className={inputClass} />
      </Field>
      <div className="grid grid-cols-[1fr_6rem] gap-2">
        <Field label="Kwota">
          <input name="amount" required inputMode="decimal" placeholder="0,00" className={`${inputClass} tabular`} />
        </Field>
        <Field label="Waluta">
          <select name="currency" defaultValue="PLN" className={inputClass}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
        </Field>
      </div>
      <Field label="Jak często">
        <select name="interval" defaultValue="monthly" className={inputClass}>
          {Object.entries(INTERVALS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </Field>
      <Field label="Kategoria">
        <select name="categoryId" required defaultValue={subscriptions} className={inputClass}>
          <option value="" disabled>Wybierz...</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
        </select>
      </Field>
      <Field label="Najbliższa płatność" hint="Data z przeszłości od razu zaksięguje zaległe płatności">
        <input name="nextDate" type="date" required defaultValue={today} className={inputClass} />
      </Field>
      {state?.error && <div className="sm:col-span-2"><Alert>{state.error}</Alert></div>}
      {state?.success && <div className="sm:col-span-2"><Alert tone="success">{state.success}</Alert></div>}
      <div className="sm:col-span-2"><Button type="submit" disabled={pending}>Dodaj</Button></div>
    </form>
  );
}
