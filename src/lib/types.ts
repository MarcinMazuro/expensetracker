import type { Currency } from "./money";
import type { ProductGroup, Unit } from "./product-groups";

export type Role = "admin" | "member";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  disabled: boolean;
  /** Bumped on password change - invalidates every older session cookie. */
  sessionVersion: number;
  createdAt: string;
  /** Colour of this person in shared views. */
  color: string;
  /** Google profile photo URL. */
  picture?: string;
  /** Chosen avatar (see AVATARS), shown instead of the Google photo. */
  avatar?: string;
  lastLoginAt?: string;
}

export interface Category {
  id: string;
  name: string;
  emoji: string;
  color: string;
  /** Monthly budget in PLN minor units, 0 = no budget. */
  budget: number;
  order: number;
}

export type ExpenseSource = "manual" | "receipt" | "recurring";

export interface ReceiptItem {
  /** Name as printed (expanded), e.g. "Marchew myta 1 kg". */
  name: string;
  /** Line price in the expense currency, minor units. */
  amount: number;
  /** Generic product, e.g. "marchew" - the key of per-product statistics. Missing on receipts saved before it existed. */
  product?: string;
  quantity?: number;
  unit?: Unit;
  group?: ProductGroup;
  /** Category the line was assigned on the receipt. */
  categoryId?: string;
}

export interface SharedInfo {
  /** The whole amount before splitting, in the expense currency. */
  total: number;
  /** User ids, in a fixed order - the order decides who gets the odd grosz. */
  participants: string[];
  paidBy: string;
  /** The receipt lines before splitting, for editing the whole expense. */
  items?: ReceiptItem[];
}

export interface Expense {
  id: string;
  /** Amount in the original currency, minor units. */
  amount: number;
  currency: Currency;
  /** Amount in PLN, minor units - every statistic is computed on this. */
  amountPln: number;
  /** PLN per one unit of `currency` (NBP table A), 1 for PLN. */
  fxRate: number;
  date: string;
  merchant: string;
  categoryId: string;
  note: string;
  tags: string[];
  source: ExpenseSource;
  /** Object name of the receipt photo in the receipts bucket. */
  receiptPath?: string;
  items?: ReceiptItem[];
  recurringId?: string;
  /** Set on both copies of an expense split equally between people. */
  shared?: SharedInfo;
  createdAt: string;
  updatedAt: string;
  /** Who last changed it - shown when it was the other person. */
  updatedBy?: string;
}

export type Interval = "weekly" | "monthly" | "quarterly" | "yearly";

export interface RecurringExpense {
  id: string;
  name: string;
  amount: number;
  currency: Currency;
  categoryId: string;
  interval: Interval;
  /** Date of the next charge that has not been booked yet. */
  nextDate: string;
  /** Day of month the charge was set up on (keeps "31st" across short months). */
  anchorDay: number;
  active: boolean;
  createdAt: string;
}
