import type { Metadata } from "next";
import Link from "next/link";
import { logout, setAvatar } from "@/app/actions/auth";
import { NavIcon } from "@/components/Navigation";
import { Button, Card, CardTitle, PageHeader } from "@/components/ui";
import { AVATARS } from "@/lib/access";
import { requireUser } from "@/lib/session";
import { Avatar } from "@/components/Avatar";
import { SessionsForm } from "./SessionsForm";

export const metadata: Metadata = { title: "Ustawienia" };

export default async function SettingsPage() {
  const user = await requireUser();
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

      <form action={logout}>
        <Button variant="secondary" type="submit" className="w-full">Wyloguj się</Button>
      </form>
    </div>
  );
}
