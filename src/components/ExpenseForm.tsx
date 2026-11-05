"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { saveExpense, suggestCategoryFor } from "@/app/actions/expenses";
import { Avatar } from "@/components/Avatar";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { cn } from "@/lib/cn";
import { CURRENCIES, formatMoney, parseAmount, toInputValue, type Currency } from "@/lib/money";
import { UNITS, type Unit } from "@/lib/product-groups";
import { splitAmount } from "@/lib/split";
import type { Category, Expense, ReceiptItem, User } from "@/lib/types";

type Person = Pick<User, "id" | "name" | "color" | "picture" | "avatar">;

interface Row {
  key: number;
  name: string;
  quantity: string;
  unit: Unit;
  amount: string;
  // Kept as they are when a saved line is edited
  product?: string;
  group?: string;
  categoryId?: string;
}

let nextKey = 0;
const toRow = (item?: ReceiptItem): Row => ({
  key: nextKey++,
  name: item?.name ?? "",
  quantity: item?.quantity !== undefined ? String(item.quantity).replace(".", ",") : "1",
  unit: item?.unit ?? "szt",
  amount: item ? toInputValue(item.amount) : "",
  product: item?.product,
  group: item?.group,
  categoryId: item?.categoryId,
});

export function ExpenseForm({
  categories,
  expense,
  today,
  merchants,
  tags,
  me,
  household,
  ownerId,
}: {
  categories: Category[];
  expense?: Expense;
  today: string;
  merchants: string[];
  tags: string[];
  me: Person;
  /** Everyone an expense can be shared with, including me. */
  household: Person[];
  /** Whose expense this is, when it is the other person's. */
  ownerId?: string;
}) {
  const [state, action, pending] = useActionState(saveExpense, undefined);
  const [categoryId, setCategoryId] = useState(expense?.categoryId ?? "");
  // Once the user picks a category by hand, suggestions never overwrite it
  const touched = useRef(Boolean(expense));
  const [hint, setHint] = useState<string | null>(null);
  const [suggesting, startSuggest] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  // A shared expense is edited as the whole amount, with all its lines
  const wholeItems = expense?.shared?.items ?? expense?.items ?? [];
  const [rows, setRows] = useState<Row[]>(wholeItems.map(toRow));
  const [showItems, setShowItems] = useState(wholeItems.length > 0);
  const [amountText, setAmountText] = useState(expense ? toInputValue(expense.shared?.total ?? expense.amount) : "");
  const [currency, setCurrency] = useState<Currency>(expense?.currency ?? "PLN");
  const [shared, setShared] = useState(Boolean(expense?.shared));

  // After "save and add another" start the next expense from scratch
  const [handledSuccess, setHandledSuccess] = useState(state?.success);
  if (state?.success !== handledSuccess) {
    setHandledSuccess(state?.success);
    setRows([]);
    setShowItems(false);
    setAmountText("");
  }

  const filledRows = rows.filter((r) => r.name.trim() || r.amount.trim());
  const itemsTotal = filledRows.reduce((s, r) => s + (parseAmount(r.amount) ?? 0), 0);
  const usesItems = showItems && filledRows.length > 0;
  const total = usesItems ? itemsTotal : parseAmount(amountText) ?? 0;
  const people = expense?.shared ? household.filter((p) => expense.shared!.participants.includes(p.id)) : household;
  const payer = expense?.shared?.paidBy ?? me.id;
  const shares = splitAmount(total, Math.max(people.length, 1), Math.max(0, people.findIndex((p) => p.id === payer)));

  function suggest(force = false) {
    const form = formRef.current;
    if (!form || (touched.current && !force)) return;
    const merchant = (form.elements.namedItem("merchant") as HTMLInputElement).value;
    const note = (form.elements.namedItem("note") as HTMLTextAreaElement).value;
    if (merchant.trim().length < 2) return;

    startSuggest(async () => {
      const result = await suggestCategoryFor(merchant, note, ownerId);
      if (!result.categoryId) {
        setHint(force ? "Brak podpowiedzi - wybierz ręcznie." : null);
        return;
      }
      setCategoryId(result.categoryId);
      setHint(result.source === "memory" ? "Tak jak ostatnio u tego sprzedawcy" : "Podpowiedź AI - zmień, jeśli nie pasuje");
    });
  }

  const updateRow = (key: number, patch: Partial<Row>) => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <form ref={formRef} action={action} className="space-y-5"
      // Reset after "save and add another" without losing date and currency
      key={state?.success}>
      {expense && <input type="hidden" name="id" value={expense.id} />}
      {ownerId && <input type="hidden" name="owner" value={ownerId} />}
      <input type="hidden" name="items" value={JSON.stringify(showItems ? filledRows.map(({ name, quantity, unit, amount, product, group, categoryId }) => ({ name, quantity, unit, amount, product, group, categoryId })) : [])} />

      <div className="grid grid-cols-[1fr_6.5rem] gap-3">
        <Field label={usesItems ? "Kwota (suma pozycji)" : shared ? "Kwota całkowita" : "Kwota"}>
          <input name="amount" inputMode="decimal" required autoFocus={!expense} placeholder="0,00"
            value={usesItems ? toInputValue(itemsTotal) : amountText} readOnly={usesItems}
            onChange={(e) => setAmountText(e.target.value)} autoComplete="off"
            className={cn(inputClass, "h-12 text-xl font-semibold tabular", usesItems && "bg-surface-muted")} />
        </Field>
        <Field label="Waluta">
          <select name="currency" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className={`${inputClass} h-12`}>
            {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
      </div>

      {household.length > 1 && (
        <label className={cn("flex cursor-pointer items-center gap-4 rounded-2xl border p-4 transition",
          shared ? "border-accent bg-accent-soft/40" : "border-line hover:bg-surface-muted")}>
          <input type="checkbox" name="shared" checked={shared} onChange={(e) => setShared(e.target.checked)} className="size-5 accent-[var(--c-accent)]" />
          <span className="flex -space-x-2">{people.map((p) => <Avatar key={p.id} user={p} size={34} ring />)}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">Wspólny wydatek</span>
            <span className="block text-xs text-fg-muted">
              {shared && total > 0
                ? people.map((p, i) => `${p.id === me.id ? "Ty" : p.name} ${formatMoney(shares[i], currency)}`).join(" · ")
                : "Podziel po równo - każde konto dostaje swoją część"}
            </span>
          </span>
        </label>
      )}

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

      <div className="rounded-2xl border border-line">
        <button type="button" onClick={() => { setShowItems((v) => !v); if (rows.length === 0) setRows([toRow()]); }}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm">
          <span>
            <span className="font-medium">Pozycje i ilości</span>
            <span className="ml-2 text-fg-muted">{filledRows.length ? `${filledRows.length} · ${formatMoney(itemsTotal, currency)}` : "opcjonalnie - do statystyk produktów"}</span>
          </span>
          <span className="text-fg-muted" aria-hidden>{showItems ? "▴" : "▾"}</span>
        </button>
        {showItems && (
          <div className="border-t border-line px-3 pt-2 pb-3">
            <div className="hidden grid-cols-[1fr_4.5rem_4.5rem_6rem_2rem] gap-2 px-1 pb-1 text-xs text-fg-muted sm:grid">
              <span>Nazwa</span><span className="text-right">Ilość</span><span>Jedn.</span><span className="text-right">Cena</span><span />
            </div>
            <ul className="space-y-2">
              {rows.map((row) => (
                <li key={row.key} className="grid grid-cols-[1fr_2rem] gap-2 sm:grid-cols-[1fr_4.5rem_4.5rem_6rem_2rem]">
                  <input value={row.name} onChange={(e) => updateRow(row.key, { name: e.target.value, ...(row.product && e.target.value !== row.name && { product: undefined, group: undefined }) })}
                    placeholder="np. marchew" aria-label="Nazwa pozycji" className={cn(inputClass, "h-9")} />
                  <button type="button" onClick={() => setRows((list) => list.filter((r) => r.key !== row.key))}
                    className="text-fg-muted hover:text-danger sm:order-last" aria-label={`Usuń ${row.name || "pozycję"}`}>✕</button>
                  <div className="col-span-2 grid grid-cols-[1fr_5rem_1fr] gap-2 sm:col-span-1 sm:contents">
                    <input value={row.quantity} onChange={(e) => updateRow(row.key, { quantity: e.target.value })} inputMode="decimal"
                      aria-label="Ilość" className={cn(inputClass, "h-9 text-right tabular")} />
                    <select value={row.unit} onChange={(e) => updateRow(row.key, { unit: e.target.value as Unit })} aria-label="Jednostka"
                      className={cn(inputClass, "h-9 px-2")}>
                      {UNITS.map((u) => <option key={u} value={u}>{u === "szt" ? "szt." : u}</option>)}
                    </select>
                    <input value={row.amount} onChange={(e) => updateRow(row.key, { amount: e.target.value })} inputMode="decimal"
                      placeholder="0,00" aria-label="Cena pozycji" className={cn(inputClass, "h-9 text-right tabular")} />
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center justify-between">
              <button type="button" onClick={() => setRows((list) => [...list, toRow()])} className="text-sm text-accent hover:underline">+ Dodaj pozycję</button>
              {filledRows.length > 0 && <span className="text-sm tabular">Suma: <strong>{formatMoney(itemsTotal, currency)}</strong></span>}
            </div>
            <p className="mt-2 text-xs text-fg-muted">Cena to kwota za całą pozycję. Produkt i grupę do statystyk dopasuje pamięć produktów albo AI.</p>
          </div>
        )}
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
