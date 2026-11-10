import type { Theme } from "@/lib/theme";

/** Deterministic "random" spread, so server and browser render the same flakes. */
const spread = (i: number, salt: number) => ((i * 9301 + salt * 49297) % 233280) / 233280;

/**
 * Weather of the theme: snow at Christmas, hearts drifting up in the hearts
 * theme. Behind everything, never in the way of a tap, and switched off
 * when the system asks for less motion.
 */
export function Ambient({ theme }: { theme: Theme }) {
  if (theme === "christmas") {
    return (
      <div aria-hidden className="ambient pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {Array.from({ length: 34 }, (_, i) => {
          const size = 3 + spread(i, 1) * 5;
          return (
            <span key={i} className="absolute top-0 rounded-full bg-white"
              style={{
                left: `${spread(i, 2) * 100}%`,
                width: size,
                height: size,
                opacity: 0.25 + spread(i, 3) * 0.55,
                filter: size > 6 ? "blur(1px)" : undefined,
                ["--drift" as string]: `${(spread(i, 4) - 0.5) * 16}vw`,
                animation: `snow ${9 + spread(i, 5) * 12}s linear ${-spread(i, 6) * 20}s infinite`,
              }} />
          );
        })}
      </div>
    );
  }
  if (theme === "hearts") {
    return (
      <div aria-hidden className="ambient pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {Array.from({ length: 14 }, (_, i) => (
          <span key={i} className="absolute bottom-[-2rem] select-none"
            style={{
              left: `${spread(i, 2) * 96}%`,
              fontSize: 14 + spread(i, 1) * 22,
              ["--drift" as string]: `${(spread(i, 4) - 0.5) * 14}vw`,
              ["--peak" as string]: 0.25 + spread(i, 3) * 0.35,
              animation: `float-up ${11 + spread(i, 5) * 10}s ease-in ${-spread(i, 6) * 20}s infinite`,
            }}>
            {i % 3 === 0 ? "💗" : i % 3 === 1 ? "🩷" : "❤️"}
          </span>
        ))}
      </div>
    );
  }
  return null;
}

/** A string of lights along the top edge, for the Christmas theme. */
export function Lights() {
  const colors = ["#f6c655", "#f0484e", "#4ade80", "#60a5fa", "#f472b6"];
  return (
    <div aria-hidden className="santa-hat pointer-events-none !static -mb-1 h-3 w-full overflow-hidden">
      <svg viewBox="0 0 400 12" preserveAspectRatio="none" className="h-3 w-full">
        <path d="M0 2 Q 25 9 50 2 T 100 2 T 150 2 T 200 2 T 250 2 T 300 2 T 350 2 T 400 2" fill="none" stroke="#1f3d2d" strokeWidth="1" />
        {Array.from({ length: 16 }, (_, i) => (
          <circle key={i} cx={12.5 + i * 25} cy={i % 2 ? 2.6 : 5.6} r="2.6" fill={colors[i % colors.length]}
            style={{ animation: `twinkle ${1.6 + (i % 4) * 0.5}s ease-in-out ${-(i % 5) * 0.4}s infinite` }} />
        ))}
      </svg>
    </div>
  );
}
