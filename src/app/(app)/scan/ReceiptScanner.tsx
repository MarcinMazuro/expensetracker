"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { saveReceiptExpenses, scanReceipt } from "@/app/actions/receipts";
import { Alert, Button, Card, CardTitle, CategoryBadge, Field, inputClass } from "@/components/ui";
import { Avatar } from "@/components/Avatar";
import { NavIcon } from "@/components/Navigation";
import { splitByCategory, type ReceiptDraft, type ReceiptDraftItem } from "@/lib/ai/receipt-schema";
import { cn } from "@/lib/cn";
import { CURRENCIES, formatMoney, parseAmount, toInputValue } from "@/lib/money";
import { PRODUCT_GROUPS, UNITS, type Unit } from "@/lib/product-groups";
import { splitAmount } from "@/lib/split";
import type { Category, User } from "@/lib/types";

const MAX_EDGE = 2000;

/**
 * Phone photos are 3-12 MB. Scaled down to 2000 px on the long edge they
 * stay perfectly readable for the model, upload in a second on mobile data
 * and cost fewer tokens. If the browser cannot decode the file (some HEIC),
 * the original is sent and the model reads it as is.
 */
async function shrink(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.type === "image/jpeg" && file.size < 2_000_000) return file;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ? new File([blob], "receipt.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

type Stage = "pick" | "reading" | "review";

type Person = Pick<User, "id" | "name" | "color" | "picture" | "avatar">;

export function ReceiptScanner({ categories, me, household }: { categories: Category[]; me: Person; household: Person[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("pick");
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receiptPath, setReceiptPath] = useState("");
  const [draft, setDraft] = useState<ReceiptDraft | null>(null);
  const [mode, setMode] = useState<"split" | "single">("split");
  const [singleCategory, setSingleCategory] = useState("");
  const [note, setNote] = useState("");
  const [tags, setTags] = useState("");
  const [shared, setShared] = useState(false);
  const [saving, startSaving] = useTransition();

  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const groups = draft ? splitByCategory(draft) : [];
  const itemsSum = draft?.items.reduce((s, i) => s + i.amount, 0) ?? 0;

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setPreview(URL.createObjectURL(file));
    setStage("reading");

    const form = new FormData();
    form.set("photo", await shrink(file));
    const result = await scanReceipt(form);

    if (!result.ok) {
      setError(result.error);
      setStage("pick");
      return;
    }
    const categoriesUsed = new Set(result.draft.items.map((i) => i.categoryId));
    setDraft(result.draft);
    setReceiptPath(result.receiptPath);
    setMode(categoriesUsed.size > 1 ? "split" : "single");
    setSingleCategory(splitByCategory(result.draft)[0]?.categoryId ?? categories[0]?.id ?? "");
    setStage("review");
  }

  function updateItem(index: number, patch: Partial<ReceiptDraftItem>) {
    setDraft((d) => d && { ...d, items: d.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
  }

  function save() {
    if (!draft) return;
    setError(null);
    startSaving(async () => {
      const result = await saveReceiptExpenses({ ...draft, receiptPath, mode, categoryId: singleCategory, note, tags, shared });
      if (result.error) setError(result.error);
      else router.push(`/expenses?month=${result.month}`);
    });
  }

  function reset() {
    setStage("pick");
    setDraft(null);
    setPreview(null);
    setError(null);
    setNote("");
    setTags("");
    if (inputRef.current) inputRef.current.value = "";
  }

  if (stage !== "review" || !draft) {
    return (
      <div className="mx-auto max-w-xl">
        <input ref={inputRef} type="file" accept="image/*" capture="environment" className="sr-only" id="receipt-photo"
          onChange={(e) => onFile(e.target.files?.[0])} disabled={stage === "reading"} />
        <label htmlFor="receipt-photo"
          className={cn(
            "relative flex aspect-[3/4] max-h-[60svh] w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-line bg-surface text-center transition hover:border-accent sm:aspect-[4/3]",
            stage === "reading" && "pointer-events-none",
          )}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}>
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className={cn("absolute inset-0 size-full object-contain", stage === "reading" && "opacity-40 blur-[1px]")} />
          )}
          {stage === "reading" ? (
            <span className="relative flex flex-col items-center gap-3 rounded-2xl bg-surface/90 px-6 py-5">
              <span className="size-8 animate-spin rounded-full border-[3px] border-accent border-t-transparent" />
              <span className="font-medium">Czytam paragon...</span>
              <span className="text-xs text-fg-muted">Zwykle 5-15 sekund</span>
            </span>
          ) : (
            <span className="relative flex flex-col items-center gap-3 px-6">
              <span className="flex size-16 items-center justify-center rounded-2xl bg-accent-soft text-accent">
                <NavIcon name="scan" className="size-8" />
              </span>
              <span className="text-lg font-medium">Zrób zdjęcie paragonu</span>
              <span className="max-w-xs text-sm text-fg-muted">
                albo wybierz z galerii / przeciągnij plik. Cały paragon w kadrze, płasko, w dobrym świetle.
              </span>
            </span>
          )}
        </label>
        {error && <div className="mt-4"><Alert>{error}</Alert></div>}
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-4">
        <Card>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Sklep">
              <input value={draft.merchant} onChange={(e) => setDraft({ ...draft, merchant: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Data">
              <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Suma do zapłaty">
              <AmountInput value={draft.total} onChange={(total) => setDraft({ ...draft, total })} className="font-semibold" />
            </Field>
            <Field label="Waluta">
              <select value={draft.currency} onChange={(e) => setDraft({ ...draft, currency: e.target.value as ReceiptDraft["currency"] })} className={inputClass}>
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          {Math.abs(itemsSum - draft.total) > Math.max(5, draft.total * 0.01) && draft.items.length > 0 && (
            <div className="mt-4">
              <Alert tone="warning">
                Pozycje sumują się do {formatMoney(itemsSum, draft.currency)}, a suma to {formatMoney(draft.total, draft.currency)}.
                Sprawdź z paragonem - różnica trafi do największej kategorii.
              </Alert>
            </div>
          )}
        </Card>

        <Card>
          <CardTitle>Jak zapisać</CardTitle>
          {household.length > 1 && (
            <label className={cn("mb-3 flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition",
              shared ? "border-accent bg-accent-soft/40" : "border-line hover:bg-surface-muted")}>
              <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} className="size-5 accent-[var(--c-accent)]" />
              <span className="flex -space-x-2">{household.map((p) => <Avatar key={p.id} user={p} size={30} ring />)}</span>
              <span className="min-w-0 flex-1 text-sm">
                <span className="block font-medium">Wspólne zakupy</span>
                <span className="block text-xs text-fg-muted">
                  {shared
                    ? household.map((p, i) => `${p.id === me.id ? "Ty" : p.name} ${formatMoney(splitAmount(draft.total, household.length, Math.max(0, household.findIndex((h) => h.id === me.id)))[i], draft.currency)}`).join(" · ")
                    : "Podziel po równo między konta"}
                </span>
              </span>
            </label>
          )}
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface-muted p-1 text-sm">
            {([["split", `Podziel na kategorie (${groups.length})`], ["single", "Jeden wydatek"]] as const).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setMode(value)}
                className={cn("rounded-lg px-3 py-2 transition", mode === value ? "bg-surface font-medium shadow-sm" : "text-fg-muted")}>
                {label}
              </button>
            ))}
          </div>
          {mode === "split" ? (
            <ul className="mt-4 space-y-2 text-sm">
              {groups.map((g) => {
                const c = byId.get(g.categoryId);
                return (
                  <li key={g.categoryId} className="flex items-center justify-between gap-2">
                    {c && <CategoryBadge emoji={c.emoji} name={c.name} color={c.color} />}
                    <span className="tabular">{formatMoney(g.amount, draft.currency)} <span className="text-fg-muted">· {g.items.length} poz.</span></span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="mt-4">
              <select value={singleCategory} onChange={(e) => setSingleCategory(e.target.value)} className={inputClass} aria-label="Kategoria całego paragonu">
                {categories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
              </select>
            </div>
          )}
        </Card>

        <Card className="px-3">
          <CardTitle>
            <span className="px-2">Pozycje ({draft.items.length}) · pod spodem produkt i ilość do statystyk</span>
          </CardTitle>
          <ul className="divide-y divide-line">
            {draft.items.map((item, i) => (
              <li key={i} className="grid grid-cols-[1fr_6.5rem_2rem] items-center gap-2 px-2 py-2.5 sm:grid-cols-[1fr_12rem_6.5rem_2rem]">
                <input value={item.name} onChange={(e) => updateItem(i, { name: e.target.value })}
                  className="min-w-0 bg-transparent text-sm outline-none focus:underline" aria-label="Nazwa pozycji" />
                <select value={item.categoryId} onChange={(e) => updateItem(i, { categoryId: e.target.value })}
                  className={cn(inputClass, "col-span-3 row-start-2 h-8 text-xs sm:col-span-1 sm:row-start-auto")} aria-label="Kategoria pozycji"
                  style={{ borderColor: byId.get(item.categoryId)?.color }}>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
                </select>
                <AmountInput value={item.amount} onChange={(amount) => updateItem(i, { amount })} className="h-8 text-right text-sm" />
                <button type="button" onClick={() => setDraft({ ...draft, items: draft.items.filter((_, j) => j !== i) })}
                  className="text-fg-muted hover:text-danger" aria-label={`Usuń ${item.name}`}>✕</button>
                <div className="col-span-3 flex items-center gap-2 text-xs sm:col-span-4">
                  <span aria-hidden>{PRODUCT_GROUPS[item.group].emoji}</span>
                  <input value={item.product} onChange={(e) => updateItem(i, { product: e.target.value })} aria-label="Produkt (do statystyk)"
                    title="Nazwa produktu w statystykach" className="min-w-0 flex-1 rounded-md bg-surface-muted px-2 py-1 outline-none focus:ring-2 focus:ring-accent/30" />
                  <QuantityInput value={item.quantity} onChange={(quantity) => updateItem(i, { quantity })} />
                  <select value={item.unit} onChange={(e) => updateItem(i, { unit: e.target.value as Unit })} aria-label="Jednostka"
                    className="rounded-md bg-surface-muted px-1.5 py-1 outline-none">
                    {UNITS.map((u) => <option key={u} value={u}>{u === "szt" ? "szt." : u}</option>)}
                  </select>
                </div>
              </li>
            ))}
          </ul>
          <button type="button" className="mt-2 px-2 text-sm text-accent hover:underline"
            onClick={() => setDraft({ ...draft, items: [...draft.items, { name: "Nowa pozycja", amount: 0, categoryId: singleCategory || categories[0].id, product: "", quantity: 1, unit: "szt", group: "other" }] })}>
            + Dodaj pozycję
          </button>
        </Card>

        <Card className="space-y-3">
          <Field label="Tagi" hint="Po przecinku, opcjonalnie">
            <input value={tags} onChange={(e) => setTags(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Notatka">
            <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
          </Field>
        </Card>

        {error && <Alert>{error}</Alert>}
        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={saving} className="flex-1 sm:flex-none">
            {saving ? "Zapisywanie..." : `${mode === "split" && groups.length > 1 ? `Zapisz ${groups.length} wydatki` : "Zapisz wydatek"}${shared ? " wspólnie" : ""}`}
          </Button>
          <Button variant="secondary" onClick={reset} disabled={saving}>Inny paragon</Button>
        </div>
      </div>

      {preview && (
        <aside className="order-first lg:order-none">
          <Card className="sticky top-6 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Zeskanowany paragon" className="max-h-48 w-full rounded-xl object-contain lg:max-h-[80svh]" />
          </Card>
        </aside>
      )}
    </div>
  );
}

/** Amount field that shows "12,50" but reports minor units; parses on blur. */
function AmountInput({ value, onChange, className }: { value: number; onChange: (minor: number) => void; className?: string }) {
  const [text, setText] = useState(toInputValue(value));
  const [last, setLast] = useState(value);
  // Follow outside changes (e.g. a reset) without an effect
  if (value !== last) {
    setLast(value);
    setText(toInputValue(value));
  }
  return (
    <input inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const parsed = parseAmount(text);
        if (parsed === null) setText(toInputValue(value));
        else { setLast(parsed); onChange(parsed); }
      }}
      className={cn(inputClass, "tabular", className)} aria-label="Kwota" />
  );
}

/** Quantity like "0,834"; parsed on blur, falls back to the previous value. */
function QuantityInput({ value, onChange }: { value: number; onChange: (quantity: number) => void }) {
  const show = (v: number) => String(v).replace(".", ",");
  const [text, setText] = useState(show(value));
  const [last, setLast] = useState(value);
  if (value !== last) {
    setLast(value);
    setText(show(value));
  }
  return (
    <input inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} aria-label="Ilość"
      onBlur={() => {
        const parsed = Number(text.replace(",", ".").trim());
        if (!Number.isFinite(parsed) || parsed <= 0) setText(show(value));
        else { setLast(parsed); onChange(parsed); }
      }}
      className="w-16 rounded-md bg-surface-muted px-2 py-1 text-right outline-none tabular focus:ring-2 focus:ring-accent/30" />
  );
}
