import type { Metadata } from "next";
import { toggleUser } from "@/app/actions/admin";
import { Avatar } from "@/components/Avatar";
import { Card, CardTitle, PageHeader } from "@/components/ui";
import { allowedEmails } from "@/lib/access";
import { requireAdmin } from "@/lib/session";
import { listUsers } from "@/lib/users";

export const metadata: Metadata = { title: "Dostęp" };

const when = (iso?: string) => (iso ? new Date(iso).toLocaleString("pl-PL", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Warsaw" }) : "jeszcze nie");

export default async function AdminPage() {
  const admin = await requireAdmin();
  const users = await listUsers();
  const allowed = [...allowedEmails()];
  const invited = allowed.filter((email) => !users.some((u) => u.email === email));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="Dostęp"
        subtitle="Logować się mogą tylko adresy Google z listy w Terraformie (zmienna allowed_emails). Konto powstaje przy pierwszym logowaniu." />
      <Card className="px-3">
        <CardTitle><span className="px-2">Konta</span></CardTitle>
        <ul className="divide-y divide-line">
          {users.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 px-2 py-3">
              <Avatar user={u} size={36} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {u.name} {u.role === "admin" && <span className="ml-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">admin</span>}
                  {u.disabled && <span className="ml-1 rounded-full bg-danger-soft px-2 py-0.5 text-xs text-danger">zablokowane</span>}
                  {!allowed.includes(u.email) && <span className="ml-1 rounded-full bg-warning-soft px-2 py-0.5 text-xs text-warning">spoza listy</span>}
                </span>
                <span className="block truncate text-xs text-fg-muted">{u.email} · ostatnio: {when(u.lastLoginAt)}</span>
              </span>
              {u.id !== admin.id && (
                <form action={toggleUser}>
                  <input type="hidden" name="id" value={u.id} />
                  <button className="rounded-lg px-2 py-1 text-xs text-fg-muted hover:bg-surface-muted hover:text-fg">{u.disabled ? "Odblokuj" : "Zablokuj"}</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </Card>
      {invited.length > 0 && (
        <Card>
          <CardTitle>Zaproszeni, jeszcze się nie logowali</CardTitle>
          <ul className="space-y-1 text-sm">{invited.map((e) => <li key={e}>{e}</li>)}</ul>
        </Card>
      )}
    </div>
  );
}
