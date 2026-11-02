import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-5xl">🧾</p>
      <h1 className="text-xl font-semibold">Nie ma takiej strony</h1>
      <Link href="/" className="text-sm text-accent hover:underline">Wróć do pulpitu</Link>
    </main>
  );
}
