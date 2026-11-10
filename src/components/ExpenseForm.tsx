"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { saveExpense, suggestCategoryFor } from "@/app/actions/expenses";
import { HiddenFields, type HiddenMode } from "@/components/HiddenFields";
import { AssignChip, HideChip, ShareControls, type Person } from "@/components/ShareControls";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { cn } from "@/lib/cn";
import { toWarsawInput } from "@/lib/dates";
import { CURRENCIES, formatMoney, parseAmount, toInputValue, type Currency } from "@/lib/money";
import { UNITS, type Unit } from "@/lib/product-groups";
import { divide, normalizeWeights, SPLIT } from "@/lib/sharing";
import type { Category, Expense, ReceiptItem } from "@/lib/types";

interface Row {
  key: number;
  name: string;
  quantity: string;
  unit: Unit;
  amount: string;
  /** "split" or the id of the one person the line belongs to. */
  assign: string;
  hidden: boolean;
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
  assign: item?.assign ?? SPLIT,
  hidden: item?.hidden === true,
  product: item?.product,
  group: item?.group,
  categoryId: item?.categoryId,
});

/** The whole expense behind the copy being edited - see loadWhole. */
export interface WholeProps {
  total: number;
  items: ReceiptItem[];
  home: string;
  hidden: boolean;
  hiddenUntil?: string;
}

export function ExpenseForm({
  categories,
  expense,
  whole,
  today,
  merchants,
  tags,
  me,
  household,
  ownerId,
}: {
  categories: Category[];
  expense?: Expense;
  whole?: WholeProps;
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

  // People taking part, me first - that order is the slider's left and right
  const base = expense?.shared ? household.filter((p) => expense.shared!.participants.includes(p.id)) : household;
  const people = [...base].sort((a, b) => (a.id === me.id ? -1 : b.id === me.id ? 1 : 0));
  const other = people.find((p) => p.id !== me.id);
  const ids = people.map((p) => p.id);
  // Only whoever keeps the full version can hide things in it
  const home = whole?.home ?? ownerId ?? me.id;
  const canHide = home === me.id && household.length > 1;

  // A shared expense is edited as the whole amount, with all its lines
  const [rows, setRows] = useState<Row[]>((whole?.items ?? []).map(toRow));
  const [showItems, setShowItems] = useState((whole?.items.length ?? 0) > 0);
  const [amountText, setAmountText] = useState(expense ? toInputValue(whole?.total ?? expense.amount) : "");
  const [currency, setCurrency] = useState<Currency>(expense?.currency ?? "PLN");
  const [shared, setShared] = useState(Boolean(expense?.shared));
  const [paidBy, setPaidBy] = useState(expense?.shared?.paidBy ?? me.id);
  const [weights, setWeights] = useState(() => normalizeWeights(ids, expense?.shared?.weights));
  const [hidden, setHidden] = useState(whole?.hidden ?? false);
  const [hiddenMode, setHiddenMode] = useState<HiddenMode>(whole?.hiddenUntil ? "time" : "manual");
  const [hiddenUntil, setHiddenUntil] = useState(whole?.hiddenUntil ? toWarsawInput(whole.hiddenUntil) : "");

  // After "save and add another" start the next expense from scratch
  const [handledSuccess, setHandledSuccess] = useState(state?.success);
  if (state?.success !== handledSuccess) {
    setHandledSuccess(state?.success);
    setRows([]);
    setShowItems(false);
    setAmountText("");
    setHidden(false);
    setHiddenUntil("");
  }

  const filledRows = rows.filter((r) => r.name.trim() || r.amount.trim());
  const itemsTotal = filledRows.reduce((s, r) => s + (parseAmount(r.amount) ?? 0), 0);
  const usesItems = showItems && filledRows.length > 0;
  const total = usesItems ? itemsTotal : parseAmount(amountText) ?? 0;
  const lines = usesItems ? filledRows : [];
  const hiddenCount = canHide ? lines.filter((r) => r.hidden).length : 0;

  // The same arithmetic the server will do, for the live preview
  const parts = divide({
    total,
    items: lines.map((r) => ({ name: r.name, amount: parseAmount(r.amount) ?? 0, assign: r.assign, hidden: canHide && r.hidden })),
    shared,
    participants: ids,
    paidBy,
    home,
    weights,
  }).parts;

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
  const sentItems = showItems
    ? filledRows.map(({ name, quantity, unit, amount, product, group, categoryId: itemCategory, assign, hidden: lineHidden }) => ({
        name, quantity, unit, amount, product, group, categoryId: itemCategory,
        ...(shared && assign !== SPLIT && { assign }),
        ...(canHide && lineHidden && { hidden: true }),
      }))
    : [];

  return (
    <form ref={formRef} action={action} className="space-y-5"
      // Reset after "save and add another" without losing date and currency
      key={state?.success}>
      {expense && <input type="hidden" name="id" value={expense.id} />}
      {ownerId && <input type="hidden" name="owner" value={ownerId} />}
      <input type="hidden" name="items" value={JSON.stringify(sentItems)} />

      <div className="grid grid-cols-[1fr_6.5rem] gap-3">
        <Field label={usesItems ? "Kwota (suma pozycji)" : shared ? "Kwota całkowita" : "Kwota"}>
          <input name="amount" inputMode="decimal" required autoFocus={!expense} placeholder="0,00"
            value={usesItems ? toInputValue(itemsTotal) : amountText} readOnly={usesItems}
            onChange={(e) => setAmountText(e.target.value)} autoComplete="off"
            className={cn(inputClass, "h-14 font-display text-2xl font-semibold tabular sm:text-2xl", usesItems && "bg-surface-muted")} />
        </Field>
        <Field label="Waluta">
          <select name="currency" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className={cn(inputClass, "h-14")}>
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

      {people.length > 1 && (
        <ShareControls people={people} me={me} shared={shared}
          onShared={(value) => { setShared(value); if (value) setHidden(false); }}
          paidBy={paidBy} onPaidBy={setPaidBy} weights={weights} onWeights={setWeights}
          parts={Object.fromEntries(ids.map((id) => [id, parts[id]?.amount ?? 0]))} currency={currency} hasLines={usesItems} />
      )}

      <div className="rounded-3xl border border-line">
        <button type="button" onClick={() => { setShowItems((v) => !v); if (rows.length === 0) setRows([toRow()]); }}
          className="flex w-full items-center justify-between px-4 py-3.5 text-left text-sm">
          <span>
            <span className="font-medium">Pozycje i ilości</span>
            <span className="ml-2 text-fg-muted">{filledRows.length ? `${filledRows.length} · ${formatMoney(itemsTotal, currency)}` : "opcjonalnie"}</span>
          </span>
          <span className={cn("text-fg-muted transition-transform duration-300", showItems && "rotate-180")} aria-hidden>▾</span>
        </button>
        {showItems && (
          <div className="animate-rise border-t border-line px-3 pt-3 pb-3">
            <ul className="space-y-3">
              {rows.map((row) => (
                <li key={row.key} className={cn("rounded-2xl border border-line/70 p-2.5 transition-colors", row.hidden && canHide && "border-accent/60 bg-accent-soft/30")}>
                  <div className="flex gap-2">
                    <input value={row.name} onChange={(e) => updateRow(row.key, { name: e.target.value, ...(row.product && e.target.value !== row.name && { product: undefined, group: undefined }) })}
                      placeholder="np. marchew" aria-label="Nazwa pozycji" className={cn(inputClass, "h-10")} />
                    <button type="button" onClick={() => setRows((list) => list.filter((r) => r.key !== row.key))}
                      className="w-8 shrink-0 text-fg-muted transition hover:text-danger active:scale-90" aria-label={`Usuń ${row.name || "pozycję"}`}>✕</button>
                  </div>
                  <div className="mt-2 grid grid-cols-[1fr_5rem_1fr] gap-2">
                    <input value={row.quantity} onChange={(e) => updateRow(row.key, { quantity: e.target.value })} inputMode="decimal"
                      aria-label="Ilość" className={cn(inputClass, "h-10 text-right tabular")} />
                    <select value={row.unit} onChange={(e) => updateRow(row.key, { unit: e.target.value as Unit })} aria-label="Jednostka"
                      className={cn(inputClass, "h-10 px-2")}>
                      {UNITS.map((u) => <option key={u} value={u}>{u === "szt" ? "szt." : u}</option>)}
                    </select>
                    <input value={row.amount} onChange={(e) => updateRow(row.key, { amount: e.target.value })} inputMode="decimal"
                      placeholder="0,00" aria-label="Cena pozycji" className={cn(inputClass, "h-10 text-right tabular")} />
                  </div>
                  {(shared || canHide) && other && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {shared && (
                        <AssignChip people={people} me={me} value={row.hidden && canHide ? me.id : row.assign}
                          onChange={(assign) => updateRow(row.key, { assign, ...(assign !== me.id && { hidden: false }) })} />
                      )}
                      {canHide && (
                        // A hidden line can only be your own
                        <HideChip hidden={row.hidden} onChange={(value) => updateRow(row.key, { hidden: value, ...(value && shared && { assign: me.id }) })} />
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center justify-between">
              <button type="button" onClick={() => setRows((list) => [...list, toRow()])} className="text-sm font-medium text-accent active:scale-95">+ Dodaj pozycję</button>
              {filledRows.length > 0 && <span className="text-sm tabular">Suma: <strong>{formatMoney(itemsTotal, currency)}</strong></span>}
            </div>
            <p className="mt-2 text-xs text-fg-muted">Cena to kwota za całą pozycję. Produkt do statystyk dopasuje pamięć produktów albo AI.</p>
          </div>
        )}
      </div>

      {/* Only whoever added the expense decides about hiding */}
      {canHide && (
        <HiddenFields hidden={hidden} onHidden={(value) => { setHidden(value); if (value) setShared(false); }}
          mode={hiddenMode} onMode={setHiddenMode} until={hiddenUntil} onUntil={setHiddenUntil}
          otherName={household.find((p) => p.id !== me.id)?.name} hiddenLines={hiddenCount} wholeAllowed={!shared} />
      )}

      <Field label="Tagi" hint="Po przecinku, np. wakacje, auto">
        <input name="tags" list="tag-list" defaultValue={expense?.tags.join(", ")} autoComplete="off" className={inputClass} />
        <datalist id="tag-list">{tags.map((t) => <option key={t} value={t} />)}</datalist>
      </Field>

      <Field label="Notatka">
        <textarea name="note" rows={2} maxLength={1000} defaultValue={expense?.note} className={cn(inputClass, "h-auto py-2.5")} />
      </Field>

      {state?.error && <Alert>{state.error}</Alert>}
      {state?.success && <Alert tone="success">{state.success}</Alert>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending} className="h-12 flex-1 text-base sm:flex-none">{pending ? "Zapisywanie..." : "Zapisz"}</Button>
        {!expense && (
          <Button type="submit" name="intent" value="another" variant="secondary" disabled={pending} className="h-12">
            Zapisz i dodaj kolejny
          </Button>
        )}
      </div>
    </form>
  );
}
