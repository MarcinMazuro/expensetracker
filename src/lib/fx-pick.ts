export interface NbpResponse {
  rates: { effectiveDate: string; mid: number }[];
}

/** The latest published rate on or before `date`, from an NBP range response. */
export function pickRate(response: NbpResponse, date: string): number | null {
  const candidates = response.rates.filter((r) => r.effectiveDate <= date);
  return candidates.at(-1)?.mid ?? null;
}
