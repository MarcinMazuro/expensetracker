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

/** Polish plural: plural(1, "wydatek", "wydatki", "wydatków") -> "1 wydatek", 3 -> "3 wydatki", 5 -> "5 wydatków". */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  const word = n === 1 ? one : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? few : many;
  return `${n} ${word}`;
}
