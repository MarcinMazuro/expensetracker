import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Logowanie" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await currentUser()) redirect("/");
  const { next } = await searchParams;

  return (
    <main className="flex min-h-svh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="mx-auto mb-4 size-12" />
          <h1 className="text-2xl font-semibold tracking-tight">ExpenseTracker</h1>
          <p className="mt-1 text-sm text-fg-muted">Zaloguj się, żeby zobaczyć swoje wydatki.</p>
        </div>
        <LoginForm next={typeof next === "string" ? next : "/"} />
        <p className="mt-6 text-center text-xs text-fg-muted">
          Konta zakłada administrator. Nie masz dostępu? Napisz do Marcina.
        </p>
      </div>
    </main>
  );
}
