import Link from "next/link";
import { Animal } from "@/components/Animal";

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-3 px-4 text-center">
      <Animal species="puma" pose="lick" className="animate-rise h-44 w-56" />
      <h1 className="font-display text-2xl font-semibold tracking-tight">Nie ma takiej strony</h1>
      <p className="max-w-xs text-sm text-fg-muted">Puma sprawdziła wszędzie. Adres jest błędny albo wydatek został usunięty.</p>
      <Link href="/" className="mt-2 inline-flex h-11 items-center rounded-2xl bg-accent px-5 text-sm font-medium text-accent-fg">Wróć do pulpitu</Link>
    </main>
  );
}
