import type { Metadata } from "next";
import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { NavIcon } from "@/components/Navigation";
import { Button, Card, CardTitle, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/session";
import { PasswordForm } from "./PasswordForm";

export const metadata: Metadata = { title: "Ustawienia" };

export default async function SettingsPage() {
  const user = await requireUser();
  const links = [
    { href: "/products", label: "Produkty", icon: "basket" as const },
    { href: "/categories", label: "Kategorie i budżety", icon: "tag" as const },
    { href: "/recurring", label: "Wydatki cykliczne", icon: "repeat" as const },
    ...(user.role === "admin" ? [{ href: "/admin", label: "Użytkownicy", icon: "users" as const }] : []),
  ];

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title="Ustawienia" subtitle={`${user.name} · ${user.email}`} />

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
        <CardTitle>Zmiana hasła</CardTitle>
        <PasswordForm />
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
