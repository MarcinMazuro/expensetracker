import type { Metadata } from "next";
import { toggleUser } from "@/app/actions/admin";
import { Card, CardTitle, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/session";
import { listUsers } from "@/lib/users";
import { AddUserForm, ResetPasswordForm } from "./AdminForms";

export const metadata: Metadata = { title: "Użytkownicy" };

export default async function AdminPage() {
  const admin = await requireAdmin();
  const users = await listUsers();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="Użytkownicy" subtitle="Każda osoba widzi tylko swoje wydatki. Kont nie da się założyć samemu - tylko tutaj." />
      <Card className="px-3">
        <ul className="divide-y divide-line">
          {users.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {u.name} {u.role === "admin" && <span className="ml-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">admin</span>}
                  {u.disabled && <span className="ml-1 rounded-full bg-danger-soft px-2 py-0.5 text-xs text-danger">zablokowane</span>}
                </span>
                <span className="block truncate text-xs text-fg-muted">{u.email} · od {u.createdAt.slice(0, 10)}</span>
              </span>
              <ResetPasswordForm id={u.id} />
              {u.id !== admin.id && (
                <form action={toggleUser}>
                  <input type="hidden" name="id" value={u.id} />
                  <button className="text-xs text-fg-muted hover:text-fg">{u.disabled ? "Odblokuj" : "Zablokuj"}</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardTitle>Nowe konto</CardTitle>
        <AddUserForm />
      </Card>
    </div>
  );
}
