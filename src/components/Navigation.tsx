"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { cn } from "@/lib/cn";

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
  { href: "/expenses", label: "Wydatki", icon: "list" },
  { href: "/scan", label: "Skanuj paragon", icon: "scan" },
  { href: "/reports", label: "Raporty", icon: "chart" },
  { href: "/categories", label: "Kategorie i budżety", icon: "tag" },
  { href: "/recurring", label: "Cykliczne", icon: "repeat" },
  { href: "/settings", label: "Ustawienia", icon: "settings" },
];

const MOBILE: { href: string; label: string; icon: Icon }[] = [
  { href: "/", label: "Pulpit", icon: "home" },
  { href: "/expenses", label: "Wydatki", icon: "list" },
  { href: "/scan", label: "Skanuj", icon: "scan" },
  { href: "/reports", label: "Raporty", icon: "chart" },
  { href: "/settings", label: "Więcej", icon: "settings" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function Navigation({ name, isAdmin }: { name: string; isAdmin: boolean }) {
  const pathname = usePathname();
  const items = isAdmin ? [...MAIN, { href: "/admin", label: "Użytkownicy", icon: "users" as Icon }] : MAIN;

  return (
    <>
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-line bg-surface px-4 py-6 lg:flex">
        <Link href="/" className="mb-8 flex items-center gap-2.5 px-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="size-8" />
          <span className="font-semibold tracking-tight">ExpenseTracker</span>
        </Link>
        <Link href="/expenses/new"
          className="mb-6 flex h-10 items-center justify-center gap-2 rounded-xl bg-accent text-sm font-medium text-accent-fg transition hover:opacity-90">
          <NavIcon name="plus" className="size-4" /> Dodaj wydatek
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {items.map((item) => (
            <Link key={item.href} href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                isActive(pathname, item.href) ? "bg-accent-soft font-medium text-accent" : "text-fg-muted hover:bg-surface-muted hover:text-fg",
              )}>
              <NavIcon name={item.icon} />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-line pt-4">
          <p className="truncate px-3 text-sm font-medium">{name}</p>
          <form action={logout}>
            <button className="mt-1 px-3 text-sm text-fg-muted hover:text-fg">Wyloguj</button>
          </form>
        </div>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {MOBILE.map((item) => {
          const active = isActive(pathname, item.href) || (item.href === "/settings" && ["/categories", "/recurring", "/admin"].some((p) => pathname.startsWith(p)));
          if (item.href === "/scan") {
            return (
              <Link key={item.href} href={item.href} className="flex flex-col items-center justify-center py-1.5" aria-label={item.label}>
                <span className="-mt-6 flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-fg shadow-lg shadow-accent/30">
                  <NavIcon name="scan" className="size-6" />
                </span>
                <span className="mt-0.5 text-[11px] text-fg-muted">{item.label}</span>
              </Link>
            );
          }
          return (
            <Link key={item.href} href={item.href}
              className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px]", active ? "text-accent" : "text-fg-muted")}>
              <NavIcon name={item.icon} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
