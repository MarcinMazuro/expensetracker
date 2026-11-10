"use client";

import { useEffect } from "react";

const PIECES = Array.from({ length: 18 }, (_, i) => {
  const angle = (i / 18) * Math.PI * 2;
  const distance = 60 + ((i * 37) % 50);
  return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance - 30, r: (i * 73) % 360, color: ["#f6c655", "#f0484e", "#2dd4bf", "#f472b6", "#60a5fa"][i % 5] };
});

/**
 * The answer to an action - "Zapisano", "Oddane" - floating above the
 * bottom bar. The animation itself hides it; the key replays it for a new
 * message only.
 */
export function Toast({ flash }: { flash: { id: string; text: string; kind: "ok" | "party" } | null }) {
  useEffect(() => {
    // Shown once: a reload must not bring it back
    if (flash) document.cookie = "et_flash=; path=/; max-age=0";
  }, [flash]);

  if (!flash) return null;
  return (
    <div key={flash.id} role="status" className="pointer-events-none fixed inset-x-0 bottom-28 z-50 flex justify-center px-4 lg:bottom-10">
      <div className="relative flex animate-toast items-center gap-2.5 rounded-full bg-fg px-5 py-3 text-sm font-medium text-canvas shadow-float">
        <span aria-hidden>{flash.kind === "party" ? "🎉" : "✓"}</span>
        {flash.text}
        {flash.kind === "party" && PIECES.map((p, i) => (
          <span key={i} aria-hidden className="absolute top-1/2 left-1/2 size-2 rounded-[2px]"
            style={{ background: p.color, ["--x" as string]: `${p.x}px`, ["--y" as string]: `${p.y}px`, ["--r" as string]: `${p.r}deg`, animation: "confetti 1.1s cubic-bezier(0.1, 0.8, 0.3, 1) 0.15s both" }} />
        ))}
      </div>
    </div>
  );
}
