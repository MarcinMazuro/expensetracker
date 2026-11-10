"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { Avatar } from "@/components/Avatar";
import { Lights } from "@/components/Ambient";
import { Animal } from "@/components/Animal";
import { speciesOf } from "@/lib/access";
import { cn } from "@/lib/cn";
import type { User } from "@/lib/types";

const ICONS = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  list: "M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01",
  scan: "M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 8h10M7 12h10M7 16h6",
  chart: "M3 3v18h18M7 15l4-4 3 3 6-6",
  tag: "M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01",
  repeat: "M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  users: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  plus: "M12 5v14M5 12h14",
  heart: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z",
  basket: "M5 10h14l-1.5 9a2 2 0 0 1-2 1.7h-7a2 2 0 0 1-2-1.7zM9 10l3-6 3 6M9.5 14v3M14.5 14v3",
};

type Icon = keyof typeof ICONS;

export function NavIcon({ name, className }: { name: Icon; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden className={cn("size-5 shrink-0", className)}>
      <path d={ICONS[name]} />
    </svg>
  );
}

const MAIN: { href: string; label: string; icon: Icon }[] = [
  { href: "/", label: "Pulpit", icon: "home" },
  { href: "/together", label: "Razem", icon: "heart" },
  { href: "/expenses", label: "Wydatki", icon: "list" },
  { href: "/scan", label: "Skanuj paragon", icon: "scan" },
  { href: "/reports", label: "Raporty", icon: "chart" },
  { href: "/products", label: "Produkty", icon: "basket" },
  { href: "/categories", label: "Kategorie i budżety", icon: "tag" },
  { href: "/recurring", label: "Cykliczne", icon: "repeat" },
  { href: "/settings", label: "Ustawienia", icon: "settings" },
];

const MOBILE: { href: string; label: string; icon: Icon }[] = [
  { href: "/", label: "Pulpit", icon: "home" },
  { href: "/together", label: "Razem", icon: "heart" },
  { href: "/scan", label: "Skanuj", icon: "scan" },
  { href: "/expenses", label: "Wydatki", icon: "list" },
  { href: "/settings", label: "Więcej", icon: "settings" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

type Person = Pick<User, "id" | "name" | "color" | "picture" | "avatar">;

export function Navigation({ user, isAdmin, people }: { user: Person; isAdmin: boolean; people: Person[] }) {
  const pathname = usePathname();
  const cats = people.flatMap((p) => { const species = speciesOf(p.avatar); return species ? [{ id: p.id, species }] : []; });
  const items = isAdmin ? [...MAIN, { href: "/admin", label: "Dostęp", icon: "users" as Icon }] : MAIN;

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-line bg-surface/80 px-4 py-6 backdrop-blur-xl lg:flex">
        <Link href="/" className="mb-8 flex items-center gap-2.5 px-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="size-8" />
          <span className="font-display text-xl font-semibold tracking-tight">Wydatki</span>
        </Link>
        <Link href="/expenses/new"
          className="mb-6 flex h-11 items-center justify-center gap-2 rounded-2xl bg-accent text-sm font-medium text-accent-fg shadow-float transition hover:opacity-90 active:scale-[0.98]">
          <NavIcon name="plus" className="size-4" /> Dodaj wydatek
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {items.map((item) => (
            <Link key={item.href} href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition active:scale-[0.98]",
                isActive(pathname, item.href) ? "bg-accent-soft font-medium text-accent" : "text-fg-muted hover:bg-surface-muted hover:text-fg",
              )}>
              <NavIcon name={item.icon} />
              {item.label}
            </Link>
          ))}
        </nav>
        {cats.length > 0 && (
          // The two of you at the foot of the menu - a shortcut to the shared view
          <Link href="/together" className="group mb-3 flex items-end justify-center gap-0 rounded-2xl px-2 pt-2 transition hover:bg-surface-muted" title="Razem">
            {cats.map((p, i) => (
              <Animal key={p.id} species={p.species} pose="stand"
                className={cn("transition duration-300 group-hover:-translate-y-1", i === 0 ? "h-24 w-16" : "-ml-1 h-20 w-12")} />
            ))}
          </Link>
        )}
        <div className="border-t border-line pt-4">
          <div className="flex items-center gap-3 px-2">
            <Avatar user={user} size={36} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <form action={logout}>
                <button className="text-xs text-fg-muted hover:text-fg">Wyloguj</button>
              </form>
            </div>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/75 backdrop-blur-xl lg:hidden">
        <Lights />
        <div className="flex items-center justify-between px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
          <Link href="/" className="flex items-center gap-2 active:scale-95">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" className="size-7" />
            <span className="font-display text-xl font-semibold tracking-tight">Wydatki</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/expenses/new" aria-label="Dodaj wydatek"
              className="flex size-9 items-center justify-center rounded-full bg-accent text-accent-fg shadow-float transition active:scale-90">
              <NavIcon name="plus" className="size-5" />
            </Link>
            <Link href="/together" className="flex -space-x-2 transition active:scale-95" aria-label="Razem">
              {people.map((p) => <Avatar key={p.id} user={p} size={34} ring />)}
            </Link>
          </div>
        </div>
      </header>

      {/* A floating bar: thumbs reach it, content scrolls behind its glass */}
      <nav className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 grid grid-cols-5 items-center rounded-[1.75rem] border border-line/80 bg-surface/80 px-1.5 py-1.5 shadow-float backdrop-blur-xl lg:hidden">
        {MOBILE.map((item) => {
          const active = isActive(pathname, item.href) || (item.href === "/settings" && ["/reports", "/products", "/categories", "/recurring", "/admin"].some((p) => pathname.startsWith(p)));
          if (item.href === "/scan") {
            return (
              <Link key={item.href} href={item.href} className="group flex justify-center" aria-label="Skanuj paragon">
                <span className="-mt-7 flex size-[3.75rem] animate-pulse-ring items-center justify-center rounded-full bg-accent text-accent-fg shadow-float ring-4 ring-canvas transition group-active:scale-90">
                  <NavIcon name="scan" className="size-7" />
                </span>
              </Link>
            );
          }
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
              className={cn("relative flex flex-col items-center gap-0.5 rounded-[1.25rem] py-1.5 text-[10.5px] font-medium transition active:scale-90", active ? "text-accent" : "text-fg-muted")}>
              {active && <span aria-hidden className="absolute inset-0 animate-pop rounded-[1.25rem] bg-accent-soft/70" />}
              <NavIcon name={item.icon} className={cn("relative size-[1.4rem] transition", active && "-translate-y-px scale-110")} />
              <span className="relative">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
