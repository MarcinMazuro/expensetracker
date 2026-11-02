"use server";

import { revalidatePath } from "next/cache";
import { readReceipt } from "@/lib/ai/gemini";
import { normalizeProductFields, splitByCategory, type ReceiptDraft } from "@/lib/ai/receipt-schema";
import { listCategories } from "@/lib/categories";
import { isIsoDate } from "@/lib/dates";
import { createExpense, knownProducts, rememberProducts } from "@/lib/expenses";
import { isCurrency } from "@/lib/money";
import { isRateLimited } from "@/lib/protection";
import { requireUser } from "@/lib/session";
import { ownsReceipt, saveReceipt } from "@/lib/storage";
import { optionalText, parseTags } from "@/lib/validation";

const MAX_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

export type ScanResult =
  | { ok: true; draft: ReceiptDraft; receiptPath: string }
  | { ok: false; error: string; receiptPath?: string };

/** Stores the photo, asks Gemini to read it and returns a draft for review. Nothing is saved as an expense yet. */
export async function scanReceipt(formData: FormData): Promise<ScanResult> {
  const user = await requireUser();

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Wybierz zdjęcie paragonu." };
  if (file.size > MAX_BYTES) return { ok: false, error: "Zdjęcie jest za duże (maks. 8 MB)." };
  if (!IMAGE_TYPES.has(file.type)) return { ok: false, error: "To nie wygląda na zdjęcie (JPG, PNG, WebP, HEIC)." };

  // Each scan is a model call that costs money - a generous limit per person
  if (isRateLimited(`scan:${user.id}`, { max: 40, seconds: 3600 })) {
    return { ok: false, error: "Limit skanów na godzinę wyczerpany. Spróbuj później albo dodaj wydatek ręcznie." };
  }

  const data = Buffer.from(await file.arrayBuffer());
  const [categories, products] = await Promise.all([listCategories(user.id), knownProducts(user.id)]);

  let receiptPath: string;
  try {
    receiptPath = await saveReceipt(user.id, data, file.type);
  } catch (error) {
    console.error("Saving receipt photo failed:", error);
    return { ok: false, error: "Nie udało się zapisać zdjęcia. Spróbuj ponownie." };
  }

  try {
    const draft = await readReceipt({ data, mimeType: file.type }, categories, products);
    if (!draft) {
      return { ok: false, receiptPath, error: "Nie widzę tu paragonu. Zrób wyraźniejsze zdjęcie całego paragonu albo wpisz wydatek ręcznie." };
    }
    return { ok: true, draft, receiptPath };
  } catch (error) {
    console.error("Reading receipt failed:", error);
    return { ok: false, receiptPath, error: "Model nie odczytał paragonu (błąd lub przekroczony czas). Spróbuj jeszcze raz." };
  }
}

export interface ReceiptSubmission {
  receiptPath: string;
  merchant: string;
  date: string;
  currency: string;
  total: number;
  items: { name: string; amount: number; categoryId: string; product?: string; quantity?: number; unit?: string; group?: string }[];
  mode: "split" | "single";
  /** Category of the whole receipt in "single" mode. */
  categoryId: string;
  note: string;
  tags: string;
}

/** Saves the reviewed receipt: one expense, or one per category. */
export async function saveReceiptExpenses(input: ReceiptSubmission): Promise<{ error?: string; month?: string }> {
  const user = await requireUser();
  const categoryIds = new Set((await listCategories(user.id)).map((c) => c.id));

  if (!ownsReceipt(user.id, input.receiptPath)) return { error: "Nieprawidłowy paragon." };
  if (!isIsoDate(input.date)) return { error: "Podaj poprawną datę." };
  if (!isCurrency(input.currency)) return { error: "Nieobsługiwana waluta." };
  if (!Number.isInteger(input.total) || input.total <= 0 || input.total > 100_000_000) return { error: "Nieprawidłowa suma." };

  const merchant = optionalText(input.merchant, 120) || "Paragon";
  const items = (Array.isArray(input.items) ? input.items : [])
    .slice(0, 200)
    .map((i) => {
      const name = optionalText(i.name, 120);
      return { name, amount: Math.round(Number(i.amount)), categoryId: String(i.categoryId), ...normalizeProductFields(i as Record<string, unknown>, name) };
    })
    .filter((i) => i.name && Number.isFinite(i.amount));
  if (items.some((i) => !categoryIds.has(i.categoryId))) return { error: "Każda pozycja musi mieć kategorię." };

  const base = { currency: input.currency, date: input.date, merchant, note: optionalText(input.note, 1000), tags: parseTags(input.tags) };
  const extra = { source: "receipt" as const, receiptPath: input.receiptPath };

  try {
    if (input.mode === "split" && items.length > 0) {
      for (const group of splitByCategory({ items, total: input.total })) {
        await createExpense(
          user.id,
          { ...base, amount: group.amount, categoryId: group.categoryId },
          { ...extra, items: group.items },
        );
      }
    } else {
      if (!categoryIds.has(input.categoryId)) return { error: "Wybierz kategorię." };
      await createExpense(
        user.id,
        { ...base, amount: input.total, categoryId: input.categoryId },
        { ...extra, items },
      );
    }
    await rememberProducts(user.id, items);
  } catch (error) {
    console.error("Saving receipt expenses failed:", error);
    return { error: "Nie udało się zapisać. Spróbuj ponownie." };
  }

  revalidatePath("/", "layout");
  return { month: input.date.slice(0, 7) };
}
