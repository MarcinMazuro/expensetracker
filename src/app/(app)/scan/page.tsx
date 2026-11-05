import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { listCategories } from "@/lib/categories";
import { requireUser } from "@/lib/session";
import { activeUsers } from "@/lib/users";
import { ReceiptScanner } from "./ReceiptScanner";

export const metadata: Metadata = { title: "Skanuj paragon" };

export default async function ScanPage() {
  const user = await requireUser();
  const [categories, household] = await Promise.all([listCategories(user.id), activeUsers()]);

  return (
    <>
      <PageHeader title="Skanuj paragon"
        subtitle={<>AI odczyta sklep, datę i pozycje, a potem przypisze im kategorie. Przed zapisem wszystko sprawdzisz. Bez paragonu? <Link href="/expenses/new" className="text-accent hover:underline">Dodaj ręcznie</Link>.</>} />
      <ReceiptScanner categories={categories} me={user} household={household} />
    </>
  );
}
