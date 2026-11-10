"use client";

import { useEffect, useRef } from "react";
import { formatMoney } from "@/lib/money";

/**
 * An amount that runs up to its value when it appears. The final text is in
 * the HTML from the start, so it is right without JavaScript and for screen
 * readers; only what is painted changes.
 */
export function CountUp({ value, currency, className }: { value: number; currency?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || value === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const start = performance.now();
    const duration = 900;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 4);
      el.textContent = formatMoney(Math.round(value * eased), currency);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, currency]);

  return <span ref={ref} className={className} aria-label={formatMoney(value, currency)}>{formatMoney(value, currency)}</span>;
}
