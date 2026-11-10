/** Paw prints walking across - shown while a screen loads. */
export function PawLoader({ label = "Ładowanie" }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex items-center justify-center gap-3 py-6 text-accent">
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} viewBox="0 0 24 24" className="size-6" fill="currentColor"
          style={{ animation: `paw 1.5s ease-in-out ${i * 0.22}s infinite`, transform: `translateY(${i % 2 ? 7 : -7}px) rotate(${i % 2 ? 78 : 102}deg)` }}>
          <ellipse cx="12" cy="15.5" rx="5.2" ry="4.3" />
          <ellipse cx="5.2" cy="10.2" rx="2" ry="2.7" transform="rotate(-24 5.2 10.2)" />
          <ellipse cx="9.4" cy="6.4" rx="2" ry="2.8" transform="rotate(-8 9.4 6.4)" />
          <ellipse cx="14.6" cy="6.4" rx="2" ry="2.8" transform="rotate(8 14.6 6.4)" />
          <ellipse cx="18.8" cy="10.2" rx="2" ry="2.7" transform="rotate(24 18.8 10.2)" />
        </svg>
      ))}
    </div>
  );
}
