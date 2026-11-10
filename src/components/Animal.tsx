import { SantaHat } from "@/components/SantaHat";
import { ANIMALS, HAT_ON_STAND, type Species } from "@/lib/animals";
import { cn } from "@/lib/cn";

/** A big cat in one of its poses. Decorative - the page reads the same without it. */
export function Animal<S extends Species>({ species, pose, className, flip = false, style }: {
  species: S;
  pose: keyof (typeof ANIMALS)[S]["poses"];
  /** Size and position; the image keeps its proportions inside. */
  className?: string;
  /** Mirror it, so two animals can face each other. */
  flip?: boolean;
  style?: React.CSSProperties;
}) {
  const src = (ANIMALS[species].poses as Record<string, string>)[pose as string];
  const hat = pose === "stand" ? HAT_ON_STAND[species] : null;
  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" draggable={false} className="block size-full object-contain object-bottom drop-shadow-[0_14px_14px_rgb(0_0_0/0.28)]" />
  );
  return (
    <span aria-hidden className={cn("pointer-events-none relative inline-block select-none", className)} style={style}>
      {hat ? (
        // A box with the picture's own proportions, so the hat stays on the head at any size
        <span className="absolute bottom-0 left-1/2 block h-full max-w-full -translate-x-1/2" style={{ aspectRatio: hat.ratio }}>
          <span className="relative block size-full" style={flip ? { transform: "scaleX(-1)" } : undefined}>
            {image}
            <SantaHat style={{ left: `${hat.left}%`, top: `${hat.top}%`, width: `${hat.width}%`, transform: `rotate(${hat.rotate}deg)` }} />
          </span>
        </span>
      ) : (
        <span className="block size-full" style={flip ? { transform: "scaleX(-1)" } : undefined}>{image}</span>
      )}
    </span>
  );
}
