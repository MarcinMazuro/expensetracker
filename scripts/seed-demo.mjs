#!/usr/bin/env node
/**
 * Fills the "development" database with two people and about three months
 * of realistic expenses, to preview the app locally (DEV_LOGIN=true shows
 * "sign in as..." buttons on the login page).
 *
 *   node scripts/seed-demo.mjs
 *
 * Refuses to touch any database other than "development". Deletes every
 * account in it first. Deterministic: the same data on every run.
 */
import { Firestore } from "@google-cloud/firestore";

const DATABASE = "development";
const db = new Firestore({ projectId: process.env.GOOGLE_CLOUD_PROJECT ?? "expensetracker-mm", databaseId: DATABASE });

// --- deterministic randomness ---------------------------------------------
let seed = 20261105;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
const between = (min, max) => min + rand() * (max - min);
const pick = (list) => list[Math.floor(rand() * list.length)];
const chance = (p) => rand() < p;
const grosze = (zl) => Math.round(zl * 100);

// --- calendar ---------------------------------------------------------------
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw" }).format(new Date());
const start = (() => {
  const d = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - 3);
  return d.toISOString().slice(0, 10);
})();
const days = [];
for (let d = new Date(`${start}T00:00:00Z`); d.toISOString().slice(0, 10) <= today; d.setUTCDate(d.getUTCDate() + 1)) {
  days.push(d.toISOString().slice(0, 10));
}
const weekday = (date) => (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7; // 0 = Monday
const monthIndex = (date) => days.indexOf(date) / 30; // ~0..3, for slow price inflation

// --- categories (same as src/lib/default-categories.ts) ---------------------
const CATEGORIES = [
  ["Spożywcze", "🛒", "#22c55e"], ["Restauracje i kawiarnie", "🍽️", "#f97316"], ["Transport", "🚗", "#3b82f6"],
  ["Mieszkanie i rachunki", "🏠", "#8b5cf6"], ["Zdrowie i uroda", "💊", "#ec4899"], ["Chemia i dom", "🧴", "#14b8a6"],
  ["Ubrania", "👕", "#eab308"], ["Rozrywka i hobby", "🎮", "#ef4444"], ["Subskrypcje", "📺", "#6366f1"],
  ["Elektronika", "💻", "#0ea5e9"], ["Prezenty", "🎁", "#d946ef"], ["Podróże", "✈️", "#06b6d4"],
  ["Edukacja", "📚", "#84cc16"], ["Inne", "📦", "#78716c"],
];

// --- products bought in grocery shops --------------------------------------
// [product, receipt name, group, unit, min qty, max qty, PLN per unit]
const GROCERIES = [
  ["marchew", "Marchew luz", "vegetables", "kg", 0.5, 1.5, 3.29],
  ["pierś z kurczaka", "Filet z piersi kurczaka", "meat", "kg", 0.4, 1.1, 25.99],
  ["jabłka", "Jabłka Ligol", "fruit", "kg", 0.8, 2.0, 4.49],
  ["banany", "Banany", "fruit", "kg", 0.6, 1.4, 5.99],
  ["pomidory", "Pomidory malinowe", "vegetables", "kg", 0.3, 0.9, 11.99],
  ["ogórki", "Ogórki szklarniowe", "vegetables", "kg", 0.3, 0.8, 8.99],
  ["ziemniaki", "Ziemniaki 2 kg", "vegetables", "kg", 2, 2, 2.75],
  ["cebula", "Cebula", "vegetables", "kg", 0.3, 1.0, 3.49],
  ["mleko", "Mleko 2% 1 l", "dairy", "l", 1, 3, 3.89],
  ["jajka", "Jaja z wolnego wybiegu 10 szt.", "dairy", "szt", 10, 10, 1.09],
  ["ser gouda", "Ser gouda plastry 150 g", "dairy", "kg", 0.15, 0.3, 39.9],
  ["jogurt naturalny", "Jogurt naturalny 400 g", "dairy", "kg", 0.4, 0.8, 8.7],
  ["masło", "Masło extra 200 g", "dairy", "kg", 0.2, 0.2, 39.95],
  ["chleb", "Chleb żytni 500 g", "bread", "szt", 1, 1, 5.49],
  ["bułki", "Bułka kajzerka", "bread", "szt", 2, 6, 0.59],
  ["makaron", "Makaron penne 500 g", "grains", "kg", 0.5, 1.0, 9.98],
  ["ryż", "Ryż basmati 1 kg", "grains", "kg", 1, 1, 8.99],
  ["kawa", "Kawa ziarnista 1 kg", "drinks", "kg", 1, 1, 64.99],
  ["woda", "Woda niegazowana 1,5 l", "drinks", "l", 3, 9, 0.99],
  ["łosoś", "Łosoś filet", "fish", "kg", 0.25, 0.5, 79.99],
  ["czekolada", "Czekolada gorzka", "sweets", "szt", 1, 2, 5.49],
  ["mandarynki", "Mandarynki", "fruit", "kg", 0.8, 1.5, 8.49],
  ["gruszki", "Gruszki konferencja", "fruit", "kg", 0.5, 1.0, 7.99],
  ["pizza mrożona", "Pizza mrożona", "frozen", "szt", 1, 2, 12.99],
];
const HOUSEHOLD = [
  ["płyn do naczyń", "Płyn do naczyń Ludwik", "household", "szt", 1, 1, 9.99],
  ["papier toaletowy", "Papier toaletowy 8 rolek", "household", "szt", 1, 1, 16.99],
  ["proszek do prania", "Kapsułki do prania 30 szt.", "household", "szt", 1, 1, 39.99],
  ["szampon", "Szampon Head&Shoulders", "household", "szt", 1, 1, 18.99],
  ["pasta do zębów", "Pasta do zębów Elmex", "household", "szt", 1, 2, 13.49],
];
const GROCERY_SHOPS = ["Biedronka", "Lidl", "Lidl", "Biedronka", "Auchan", "Carrefour"];

function receiptItems(catalog, count, date, preferred = []) {
  const chosen = new Set(preferred);
  while (chosen.size < count) chosen.add(pick(catalog)[0]);
  return [...chosen].map((product) => {
    const [, name, group, unit, min, max, price] = catalog.find((p) => p[0] === product);
    const quantity = unit === "kg" && min !== max ? Math.round(between(min, max) * 1000) / 1000 : Math.round(between(min, max));
    // Prices drift up a little over the months, and differ a bit between shops
    const unitPrice = price * (1 + monthIndex(date) * 0.01) * between(0.92, 1.08);
    return { name, product, group, unit, quantity, amount: grosze(quantity * unitPrice) };
  });
}

// --- the two people's habits -------------------------------------------------
function generate(person) {
  const out = [];
  const add = (date, category, merchant, zl, extra = {}) => out.push({ date, category, merchant, amount: grosze(zl), ...extra });
  const marcin = person === "marcin";

  for (const date of days) {
    const wd = weekday(date);
    const dom = Number(date.slice(8, 10));

    // Groceries: Marcin does the big weekend shop, Agnieszka small top-ups during the week
    if ((marcin && wd === 5) || (!marcin && chance(0.28)) || (marcin && chance(0.08))) {
      const items = receiptItems(GROCERIES, marcin && wd === 5 ? 9 : 4, date, marcin ? ["pierś z kurczaka", "marchew"] : ["jabłka"]);
      const merchant = !marcin && chance(0.3) ? "Żabka" : pick(GROCERY_SHOPS);
      add(date, "Spożywcze", merchant, 0, { items, source: "receipt" });
    }
    if (chance(marcin ? 0.03 : 0.06)) add(date, "Chemia i dom", "Rossmann", 0, { items: receiptItems(HOUSEHOLD, 2, date), source: "receipt" });

    // Eating out
    if (!marcin && wd < 5 && chance(0.35)) add(date, "Restauracje i kawiarnie", pick(["Costa Coffee", "Starbucks", "Green Caffè Nero"]), between(14, 26));
    if (marcin && wd < 5 && chance(0.2)) add(date, "Restauracje i kawiarnie", pick(["Kebab King", "Bistro Pod Lipą", "Pyszne.pl"]), between(28, 62));
    if (wd === 4 && chance(0.5)) add(date, "Restauracje i kawiarnie", pick(["Sushi Kushi", "Pizzeria Napoli", "Ramen Ya"]), between(90, 190), { note: "kolacja na mieście" });

    // Transport
    if (marcin && dom % 10 === 3) add(date, "Transport", pick(["Orlen", "BP", "Shell"]), between(240, 330), { tags: ["auto"] });
    if (!marcin && chance(0.18)) add(date, "Transport", pick(["Bolt", "Uber", "FreeNow"]), between(19, 42));
    if (!marcin && dom === 1) add(date, "Transport", "ZTM bilet miesięczny", 110, { source: "recurring", recurring: "ztm" });

    // Home and bills
    if (marcin && dom === 10) add(date, "Mieszkanie i rachunki", "Czynsz", 2850, { source: "recurring", recurring: "rent" });
    if (!marcin && dom === 15) add(date, "Mieszkanie i rachunki", "Tauron prąd", between(160, 230));
    if (!marcin && dom === 20) add(date, "Mieszkanie i rachunki", "Orange internet", 69.99, { source: "recurring", recurring: "internet" });

    // Subscriptions
    if (marcin && dom === 5) add(date, "Subskrypcje", "Netflix", 67, { source: "recurring", recurring: "netflix" });
    if (!marcin && dom === 12) add(date, "Subskrypcje", "Spotify Duo", 29.99, { source: "recurring", recurring: "spotify" });
    if (dom === 2) add(date, "Rozrywka i hobby", "Zdrofit karnet", marcin ? 149 : 129, { source: "recurring", recurring: "gym" });

    // Personal
    if (!marcin && chance(0.05)) add(date, "Zdrowie i uroda", pick(["Hebe", "Rossmann kosmetyki", "Fryzjer Studio Look"]), between(45, 210));
    if (marcin && chance(0.03)) add(date, "Zdrowie i uroda", "Apteka Gemini", between(18, 75));
    if (!marcin && chance(0.035)) add(date, "Ubrania", pick(["Zara", "Reserved", "Mohito"]), between(119, 349));
    if (marcin && chance(0.015)) add(date, "Ubrania", pick(["Decathlon", "4F"]), between(89, 260));
    if (marcin && chance(0.03)) add(date, "Rozrywka i hobby", pick(["Steam", "Empik", "Cinema City"]), between(39, 120));
    if (!marcin && chance(0.025)) add(date, "Edukacja", pick(["Udemy", "Empik książki"]), between(39, 89));
  }

  // One-off bigger things
  const at = (offset) => days[Math.min(days.length - 1, offset)];
  if (marcin) {
    add(at(24), "Elektronika", "Media Expert - słuchawki Sony", 899, { note: "WH-1000XM6, promocja" });
    add(at(70), "Prezenty", "Apart", 420, { note: "prezent na rocznicę", tags: ["rocznica"] });
  } else {
    add(at(40), "Podróże", "Booking.com - Zakopane", 0, { currency: "EUR", eur: 149, tags: ["wyjazd"], note: "weekend w górach" });
    add(at(41), "Podróże", "Karczma Zapiecek", 186, { tags: ["wyjazd"] });
    add(at(72), "Prezenty", "Empik", 129, { note: "urodziny Kasi" });
  }
  return out;
}

const RECURRING = {
  marcin: [
    { key: "rent", name: "Czynsz", amount: 2850, category: "Mieszkanie i rachunki", interval: "monthly", day: 10 },
    { key: "netflix", name: "Netflix", amount: 67, category: "Subskrypcje", interval: "monthly", day: 5 },
    { key: "gym", name: "Zdrofit karnet", amount: 149, category: "Rozrywka i hobby", interval: "monthly", day: 2 },
  ],
  agnieszka: [
    { key: "spotify", name: "Spotify Duo", amount: 29.99, category: "Subskrypcje", interval: "monthly", day: 12 },
    { key: "internet", name: "Orange internet", amount: 69.99, category: "Mieszkanie i rachunki", interval: "monthly", day: 20 },
    { key: "ztm", name: "ZTM bilet miesięczny", amount: 110, category: "Transport", interval: "monthly", day: 1 },
    { key: "gym", name: "Zdrofit karnet", amount: 129, category: "Rozrywka i hobby", interval: "monthly", day: 2 },
  ],
};

const BUDGETS = {
  marcin: { "Spożywcze": 1200, "Restauracje i kawiarnie": 500, "Transport": 900, "Rozrywka i hobby": 300 },
  agnieszka: { "Spożywcze": 700, "Restauracje i kawiarnie": 450, "Zdrowie i uroda": 300, "Ubrania": 400 },
};

const PEOPLE = [
  { key: "marcin", email: "mazuromarcin@gmail.com", name: "Marcin", role: "admin", color: "#0d9488", avatar: "lion" },
  { key: "agnieszka", email: "agnieszkabielawa03@gmail.com", name: "Agnieszka", role: "member", color: "#e11d48", avatar: "puma" },
];

const merchantKey = (name) => name.toLowerCase().replace(/ł/g, "l").normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim().slice(0, 100);

function nextMonthly(day) {
  const [y, m] = today.split("-").map(Number);
  const candidate = `${today.slice(0, 7)}-${String(day).padStart(2, "0")}`;
  if (candidate > today) return candidate;
  const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
  return `${next}-${String(day).padStart(2, "0")}`;
}

async function commitAll(writes) {
  for (let i = 0; i < writes.length; i += 400) {
    const batch = db.batch();
    for (const [ref, data] of writes.slice(i, i + 400)) batch.set(ref, data);
    await batch.commit();
  }
}

async function main() {
  if (DATABASE !== "development") throw new Error("seed-demo only writes to the development database");

  const existing = await db.collection("users").get();
  for (const doc of existing.docs) await db.recursiveDelete(doc.ref);
  console.log(`Removed ${existing.size} account(s) from "${DATABASE}".`);

  for (const [index, person] of PEOPLE.entries()) {
    const userRef = db.collection("users").doc(person.key);
    const createdAt = new Date(Date.UTC(2026, 6, 1 + index)).toISOString();
    const writes = [[userRef, {
      email: person.email, name: person.name, role: person.role, disabled: false, sessionVersion: 1,
      createdAt, color: person.color, avatar: person.avatar,
    }]];

    const categoryIds = {};
    CATEGORIES.forEach(([name, emoji, color], order) => {
      const ref = userRef.collection("categories").doc();
      categoryIds[name] = ref.id;
      writes.push([ref, { name, emoji, color, order, budget: grosze(BUDGETS[person.key][name] ?? 0) }]);
    });

    const recurringIds = {};
    for (const r of RECURRING[person.key]) {
      const ref = userRef.collection("recurring").doc(`demo-${r.key}`);
      recurringIds[r.key] = ref.id;
      writes.push([ref, {
        name: r.name, amount: grosze(r.amount), currency: "PLN", categoryId: categoryIds[r.category], interval: r.interval,
        nextDate: nextMonthly(r.day), anchorDay: r.day, active: true, createdAt,
      }]);
    }

    const expenses = generate(person.key);
    const merchants = new Map();
    const products = new Map();
    let spent = 0;
    for (const [i, e] of expenses.entries()) {
      const amount = e.items ? e.items.reduce((s, item) => s + item.amount, 0) : e.amount;
      const fxRate = e.currency === "EUR" ? 4.2875 : 1;
      const original = e.currency === "EUR" ? grosze(e.eur) : amount;
      const amountPln = Math.round(original * fxRate);
      spent += amountPln;
      const id = e.recurring ? `recurring_${recurringIds[e.recurring]}_${e.date}` : `demo-${String(i).padStart(4, "0")}`;
      const time = `${e.date}T${String(8 + (i % 12)).padStart(2, "0")}:${String((i * 7) % 60).padStart(2, "0")}:00.000Z`;
      writes.push([userRef.collection("expenses").doc(id), {
        amount: original, currency: e.currency ?? "PLN", amountPln, fxRate, date: e.date, merchant: e.merchant,
        categoryId: categoryIds[e.category], note: e.note ?? "", tags: e.tags ?? (e.recurring ? ["cykliczne"] : []),
        source: e.source ?? "manual", createdAt: time, updatedAt: time,
        ...(e.items && { items: e.items.map((item) => ({ ...item, categoryId: categoryIds[e.category] })) }),
        ...(e.recurring && { recurringId: recurringIds[e.recurring] }),
      }]);
      merchants.set(merchantKey(e.merchant), { name: e.merchant, categoryId: categoryIds[e.category], lastUsed: time });
      for (const item of e.items ?? []) products.set(merchantKey(item.product), { name: item.product, group: item.group, lastUsed: time });
    }
    for (const [key, data] of merchants) writes.push([userRef.collection("merchants").doc(key), data]);
    for (const [key, data] of products) writes.push([userRef.collection("products").doc(key), data]);

    await commitAll(writes);
    console.log(`${person.name}: ${expenses.length} expenses, ${(spent / 100).toFixed(2)} PLN since ${start}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
