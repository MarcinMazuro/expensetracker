"use client";

import { useActionState } from "react";
import { login } from "@/app/actions/auth";
import { Alert, Button, Field, inputClass } from "@/components/ui";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <form action={action} className="space-y-4 rounded-2xl border border-line bg-surface p-6">
      <input type="hidden" name="next" value={next} />
      <Field label="E-mail">
        <input name="email" type="email" autoComplete="username" required autoFocus defaultValue={state?.email} key={state?.email} className={inputClass} />
      </Field>
      <Field label="Hasło">
        <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </Field>
      {state?.error && <Alert>{state.error}</Alert>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Logowanie..." : "Zaloguj się"}
      </Button>
    </form>
  );
}
