/** Worn by every avatar in the Christmas theme (shown by CSS, see .santa-hat). */
export function SantaHat({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 100 84" aria-hidden className={`santa-hat pointer-events-none absolute ${className ?? ""}`} style={style}>
      <path d="M14 62C18 30 42 6 66 10c16 3 26 18 28 34-8-10-16-14-24-12 8 12 12 22 14 30z" fill="#d91f2f" />
      <path d="M66 10c16 3 26 18 28 34-8-10-16-14-24-12 2-8 0-16-4-22z" fill="#a8131f" opacity=".5" />
      <rect x="5" y="55" width="86" height="21" rx="10.5" fill="#fff" />
      <circle cx="93" cy="47" r="9.5" fill="#fff" />
    </svg>
  );
}
