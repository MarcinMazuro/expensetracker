/**
 * In-memory rate limiter, per instance. Cloud Run may run several instances,
 * so the limit is approximate, but it reliably stops a single client
 * guessing passwords or burning through the AI quota.
 */
const windows = new Map<string, number[]>();
let lastSweep = 0;

export function clientAddress(headers: Headers): string {
  // Cloud Run appends the real address at the END of x-forwarded-for. Earlier
  // entries come from the client, so a bot could use them to dodge the limit
  const header = headers.get("x-forwarded-for") ?? "";
  return header.split(",").at(-1)?.trim() || "unknown";
}

/** Returns true once the client has exceeded the limit. */
export function isRateLimited(
  key: string,
  { max, seconds }: { max: number; seconds: number },
  now = Date.now(),
): boolean {
  const cutoff = now - seconds * 1000;

  // Once a minute drop stale entries so the map does not grow forever
  if (now - lastSweep > 60_000) {
    for (const [k, hits] of windows) {
      if (hits[hits.length - 1] < now - 86_400_000) windows.delete(k);
    }
    lastSweep = now;
  }

  const hits = (windows.get(key) ?? []).filter((t) => t > cutoff);
  if (hits.length >= max) {
    windows.set(key, hits);
    return true;
  }
  hits.push(now);
  windows.set(key, hits);
  return false;
}

/** Tests: reset limiter state between cases. */
export function resetRateLimits() {
  windows.clear();
}
