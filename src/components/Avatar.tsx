import { AVATARS, isAvatarId } from "@/lib/access";
import { cn } from "@/lib/cn";
import type { User } from "@/lib/types";

/**
 * The person's picture on their colour: the chosen animal, else the Google
 * photo, else initials. The colour ring is the same as in every shared chart.
 */
export function Avatar({ user, size = 32, className, ring = false }: {
  user: Pick<User, "name" | "color" | "picture" | "avatar">;
  size?: number;
  className?: string;
  ring?: boolean;
}) {
  const initials = user.name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  const src = isAvatarId(user.avatar) ? AVATARS[user.avatar].head : user.picture;
  return (
    <span className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white", ring && "ring-2 ring-surface", className)}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: src ? `color-mix(in oklab, ${user.color} 35%, var(--c-surface))` : user.color,
        boxShadow: `inset 0 0 0 ${Math.max(1.5, size / 24)}px ${user.color}`,
      }}
      title={user.name}>
      {initials}
      {src && (
        // Over the initials; if the image fails to load, the initials stay visible
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" referrerPolicy="no-referrer" className="absolute inset-0 size-full object-cover" />
      )}
    </span>
  );
}
