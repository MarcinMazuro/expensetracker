import { ViewTransition } from "react";
import { Navigation } from "@/components/Navigation";
import { Toast } from "@/components/Toast";
import { revealDue } from "@/lib/expense-writer";
import { readFlash } from "@/lib/flash";
import { requireUser } from "@/lib/session";
import { activeUsers } from "@/lib/users";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [everyone, flash] = await Promise.all([activeUsers(), readFlash()]);
  // Me first, then everyone else in the household
  const people = everyone.sort((a, b) => (a.id === user.id ? -1 : b.id === user.id ? 1 : 0));
  // Timed reveals that came due are written down before anything is read
  await revealDue(people.map((p) => p.id));

  return (
    <>
      <Navigation user={user} isAdmin={user.role === "admin"} people={people} />
      <div className="overflow-x-clip lg:pl-64">
        <main className="mx-auto max-w-6xl min-w-0 px-4 pt-4 pb-32 sm:px-6 lg:pt-10 lg:pb-12">
          <ViewTransition>{children}</ViewTransition>
        </main>
      </div>
      <Toast flash={flash} />
    </>
  );
}
