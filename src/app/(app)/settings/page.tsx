import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { revealExpense } from "@/app/actions/expenses";
import { setTheme } from "@/app/actions/theme";
import { logout, setAvatar } from "@/app/actions/auth";
import { NavIcon } from "@/components/Navigation";
import { Button, Card, CardTitle, PageHeader } from "@/components/ui";
import { AVATARS } from "@/lib/access";
import { PHOTO_CREDITS } from "@/lib/animals";
import { formatDateTimeShort } from "@/lib/dates";
import { listHiddenExpenses } from "@/lib/expenses";
import { formatMoney } from "@/lib/money";
import { requireUser } from "@/lib/session";
import { THEME_COOKIE, THEMES, toTheme, type Theme } from "@/lib/theme";
import { Avatar } from "@/components/Avatar";
import { SessionsForm } from "./SessionsForm";

export const metadata: Metadata = { title: "Ustawienia" };

export default async function SettingsPage() {
  const user = await requireUser();
  const [hiddenExpenses, cookieStore] = await Promise.all([listHiddenExpenses(user.id), cookies()]);
  const theme = toTheme(cookieStore.get(THEME_COOKIE)?.value);
  const links = [
    { href: "/reports", label: "Raporty", icon: "chart" as const },
    { href: "/products", label: "Produkty", icon: "basket" as const },
    { href: "/categories", label: "Kategorie i budżety", icon: "tag" as const },
    { href: "/recurring", label: "Wydatki cykliczne", icon: "repeat" as const },
    ...(user.role === "admin" ? [{ href: "/admin", label: "Dostęp", icon: "users" as const }] : []),
  ];

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title="Ustawienia" />
      <Card>
        <div className="flex items-center gap-4">
          <Avatar user={user} size={56} />
          <div className="min-w-0">
            <p className="font-medium">{user.name}</p>
            <p className="truncate text-sm text-fg-muted">{user.email} · logowanie przez Google</p>
          </div>
        </div>
        <form action={setAvatar} className="mt-5">
          <p className="mb-2 text-sm font-medium">Awatar</p>
          <div className="flex flex-wrap gap-3">
            {([...Object.entries(AVATARS).map(([id, a]) => [id, a.name] as const), ["", user.picture ? "Zdjęcie Google" : "Inicjały"] as const]).map(([id, label]) => {
              const selected = (user.avatar ?? "") === id;
              return (
                <button key={id || "none"} name="avatar" value={id} aria-pressed={selected}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-xs transition ${selected ? "border-accent bg-accent-soft/50 text-accent" : "border-line hover:bg-surface-muted"}`}>
                  <Avatar user={{ ...user, avatar: id || undefined }} size={48} />
                  {label}
                </button>
              );
            })}
          </div>
        </form>
      </Card>

      <Card>
        <CardTitle>Motyw</CardTitle>
        <form action={setTheme} className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
          {(Object.entries(THEMES) as [Theme, (typeof THEMES)[Theme]][]).map(([id, t]) => (
            <button key={id} name="theme" value={id} aria-pressed={theme === id}
              className={`rounded-2xl border p-2 text-xs transition ${theme === id ? "border-accent ring-2 ring-accent/30" : "border-line hover:bg-surface-muted"}`}>
              <span aria-hidden className="relative mb-2 block h-14 overflow-hidden rounded-xl border border-line"
                style={{ background: id === "auto" ? `linear-gradient(115deg, ${t.canvas} 50%, ${t.surface} 50%)` : t.canvas }}>
                {id !== "auto" && <span className="absolute inset-x-2 top-2 h-5 rounded-md" style={{ background: t.surface }} />}
                <span className="absolute bottom-2 left-2 h-2 w-8 rounded-full" style={{ background: t.accent }} />
                {id === "hearts" && <span className="absolute right-1.5 bottom-0.5 text-base">💗</span>}
                {id === "christmas" && <span className="absolute right-1.5 bottom-0.5 text-base">🎄</span>}
              </span>
              {t.name}
            </button>
          ))}
        </form>
      </Card>

      {hiddenExpenses.length > 0 && (
        <Card className="px-3">
          <CardTitle><span className="px-2">Twoje ukryte wydatki · {hiddenExpenses.length}</span></CardTitle>
          <ul className="divide-y divide-line">
            {hiddenExpenses.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-2 py-2.5 text-sm">
                <Link href={`/expenses/${e.id}`} className="min-w-0 flex-1 hover:underline">
                  <span className="block truncate font-medium">{e.merchant}</span>
                  <span className="block text-xs text-fg-muted">
                    {formatMoney(e.amountPln)} · {e.hiddenUntil ? `odkryje się: ${formatDateTimeShort(e.hiddenUntil)}` : "do odkrycia ręcznie"}
                  </span>
                </Link>
                <form action={revealExpense}>
                  <input type="hidden" name="id" value={e.id} />
                  <Button type="submit" variant="secondary" className="h-9">Odkryj</Button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="px-3 py-2 lg:hidden">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-surface-muted">
            <NavIcon name={l.icon} className="text-fg-muted" />
            <span className="flex-1">{l.label}</span>
            <span className="text-fg-muted">›</span>
          </Link>
        ))}
      </Card>

      <Card>
        <CardTitle>Bezpieczeństwo</CardTitle>
        <SessionsForm />
      </Card>

      <Card>
        <CardTitle>Na telefonie</CardTitle>
        <p className="text-sm text-fg-muted">
          Dodaj aplikację do ekranu głównego (Safari: Udostępnij → Do ekranu początkowego, Chrome: menu → Dodaj do ekranu
          głównego). Otwiera się wtedy jak zwykła aplikacja, a przytrzymanie ikony daje skrót do skanowania paragonu.
        </p>
      </Card>

      <Card>
        <details>
          <summary className="cursor-pointer text-sm font-medium">Zdjęcia lwów i pum</summary>
          <p className="mt-3 text-sm text-fg-muted">
            Część zdjęć pochodzi z Wikimedia Commons, na wolnych licencjach. Tło zostało wycięte, a kadr zmieniony.
          </p>
          <ul className="mt-3 space-y-2 text-xs text-fg-muted">
            {PHOTO_CREDITS.map((c) => (
              <li key={c.file}>
                <a href={c.source} target="_blank" rel="noreferrer" className="text-fg underline decoration-line underline-offset-2 hover:decoration-accent">{c.title}</a>
                {" - "}{c.author}, {c.licence}
              </li>
            ))}
          </ul>
        </details>
      </Card>

      <form action={logout}>
        <Button variant="secondary" type="submit" className="w-full">Wyloguj się</Button>
      </form>
    </div>
  );
}
