import "server-only";
import { addDays } from "./dates";
import { pickRate, type NbpResponse } from "./fx-pick";
import { COLLECTIONS, db } from "./firestore";
import { BASE_CURRENCY, type Currency } from "./money";

/**
 * Exchange rates from the National Bank of Poland (NBP table A) - free, no
 * API key, and the rate Polish accounting uses. A rate for a weekend or
 * holiday comes from the last business day before it. Rates never change
 * once published, so each one is cached in Firestore forever.
 */
export async function rateToPln(currency: Currency, date: string): Promise<number> {
  if (currency === BASE_CURRENCY) return 1;

  const cacheRef = db().collection(COLLECTIONS.fxRates).doc(`${currency}_${date}`);
  const cached = await cacheRef.get();
  if (cached.exists) return cached.data()!.rate as number;

  // A 10-day window always contains a business day, even around Easter
  const from = addDays(date, -10);
  const url = `https://api.nbp.pl/api/exchangerates/rates/A/${currency}/${from}/${date}/?format=json`;
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`NBP returned ${response.status} for ${currency} ${date}`);

  const rate = pickRate((await response.json()) as NbpResponse, date);
  if (!rate) throw new Error(`No NBP rate for ${currency} before ${date}`);

  await cacheRef.set({ rate, currency, date, fetchedAt: new Date().toISOString() });
  return rate;
}
