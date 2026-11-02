/** "  Biedronka nr 1234 " -> "biedronka nr 1234" - key of the merchant memory. */
export function merchantKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 100);
}

/** Case- and accent-insensitive "contains", for the search box. */
export function matchesQuery(haystack: string, query: string): boolean {
  return merchantKey(haystack).includes(merchantKey(query));
}
