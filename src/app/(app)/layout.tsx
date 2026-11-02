import { Navigation } from "@/components/Navigation";
import { requireUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <>
      <Navigation name={user.name} isAdmin={user.role === "admin"} />
      <div className="lg:pl-64">
        <main className="mx-auto max-w-6xl px-4 pt-6 pb-28 sm:px-6 lg:pt-10 lg:pb-12">{children}</main>
      </div>
    </>
  );
}
