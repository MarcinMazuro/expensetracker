import { Navigation } from "@/components/Navigation";
import { requireUser } from "@/lib/session";
import { activeUsers } from "@/lib/users";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // Me first, then everyone else in the household
  const people = (await activeUsers()).sort((a, b) => (a.id === user.id ? -1 : b.id === user.id ? 1 : 0));

  return (
    <>
      <Navigation user={user} isAdmin={user.role === "admin"} people={people} />
      <div className="lg:pl-64">
        <main className="mx-auto max-w-6xl px-4 pt-4 pb-28 sm:px-6 lg:pt-10 lg:pb-12">{children}</main>
      </div>
    </>
  );
}
