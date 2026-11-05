import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { cn } from "@/lib/cn";
import type { User } from "@/lib/types";

type Person = Pick<User, "id" | "name" | "color" | "picture" | "avatar">;

/** Whose data the page shows - you or the other person. Keeps the other query parameters. */
export function PersonSwitcher({ people, owner, viewer, path, params = {} }: {
  people: Person[];
  owner: Person;
  viewer: Person;
  path: string;
  params?: Record<string, string>;
}) {
  if (people.length < 2) return null;
  return (
    <div className="flex rounded-2xl border border-line bg-surface p-1" role="tablist" aria-label="Czyje wydatki">
      {people.map((p) => {
        const query = new URLSearchParams(Object.entries({ ...params, u: p.id === viewer.id ? "" : p.id }).filter(([, v]) => v));
        const active = p.id === owner.id;
        return (
          <Link key={p.id} href={`${path}${query.size ? `?${query}` : ""}`} role="tab" aria-selected={active}
            className={cn("flex items-center gap-2 rounded-xl py-1 pr-3 pl-1 text-sm transition",
              active ? "font-medium text-fg shadow-sm" : "text-fg-muted hover:text-fg")}
            style={active ? { background: `color-mix(in oklab, ${p.color} 16%, var(--c-surface))` } : undefined}>
            <Avatar user={p} size={28} />
            {p.id === viewer.id ? "Moje" : p.name}
          </Link>
        );
      })}
    </div>
  );
}
