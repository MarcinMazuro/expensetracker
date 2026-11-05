import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { GoogleButton } from "@/components/GoogleButton";
import { Alert } from "@/components/ui";
import { AVATARS, devLoginEnabled } from "@/lib/access";
import { currentUser } from "@/lib/session";
import { listUsers } from "@/lib/users";

export const metadata: Metadata = { title: "Logowanie" };

const ERRORS: Record<string, string> = {
  denied: "To konto Google nie ma dostępu do aplikacji. Zaloguj się adresem, któremu go przyznano.",
  cancelled: "Logowanie zostało przerwane.",
  expired: "Logowanie trwało zbyt długo albo otwarto je w innej karcie. Spróbuj jeszcze raz.",
  failed: "Nie udało się zalogować przez Google. Spróbuj ponownie.",
  limit: "Za dużo prób logowania. Spróbuj ponownie za kilkanaście minut.",
  config: "Logowanie Google nie jest jeszcze skonfigurowane.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await currentUser()) redirect("/");
  const { next, error } = await searchParams;
  const devUsers = devLoginEnabled() ? (await listUsers()).filter((u) => !u.disabled) : [];

  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden px-4">
      {/* Soft colour wash behind the card */}
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-accent/15 blur-3xl" />
      {/* Lion and puma flank the card on wide screens */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={AVATARS.lion.full} alt="" aria-hidden className="pointer-events-none absolute bottom-0 left-[max(1rem,calc(50%-34rem))] hidden h-[26rem] drop-shadow-2xl lg:block" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={AVATARS.puma.full} alt="" aria-hidden className="pointer-events-none absolute right-[max(1rem,calc(50%-30rem))] bottom-0 hidden h-[22rem] drop-shadow-2xl lg:block" />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="mx-auto mb-5 hidden size-14 drop-shadow-lg lg:block" />
          {/* Phones: the two heads instead of the full figures */}
          <div className="mb-5 flex justify-center -space-x-3 lg:hidden" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={AVATARS.lion.head} alt="" className="size-16 rounded-full bg-accent-soft ring-4 ring-canvas" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={AVATARS.puma.head} alt="" className="size-16 rounded-full bg-danger-soft ring-4 ring-canvas" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">ExpenseTracker</h1>
          <p className="mt-2 text-sm text-fg-muted">Wspólne wydatki, budżety i paragony czytane przez AI.</p>
        </div>

        <div className="space-y-4 rounded-3xl border border-line bg-surface/80 p-6 shadow-xl shadow-black/5 backdrop-blur">
          {typeof error === "string" && ERRORS[error] && <Alert>{ERRORS[error]}</Alert>}
          <GoogleButton next={typeof next === "string" ? next : "/"} />
          <p className="text-center text-xs text-fg-muted">Dostęp mają tylko zaproszone konta Google.</p>
        </div>

        {devUsers.length > 0 && (
          <div className="mt-4 rounded-3xl border border-dashed border-warning/50 bg-warning-soft/40 p-4">
            <p className="mb-3 text-center text-xs font-medium text-warning">Podgląd lokalny - zaloguj jako</p>
            <div className="grid gap-2">
              {devUsers.map((u) => (
                <form key={u.id} action="/api/auth/dev" method="post">
                  <input type="hidden" name="uid" value={u.id} />
                  <button className="flex w-full items-center gap-3 rounded-xl bg-surface px-3 py-2 text-left text-sm transition hover:bg-surface-muted">
                    <Avatar user={u} size={28} />
                    <span className="min-w-0 flex-1">
                      <span className="block">{u.name}</span>
                      <span className="block truncate text-xs text-fg-muted">{u.email}</span>
                    </span>
                  </button>
                </form>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
