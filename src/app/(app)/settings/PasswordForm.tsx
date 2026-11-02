"use client";

import { useActionState } from "react";
import { changePassword } from "@/app/actions/auth";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-rules";

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);
  return (
    <form action={action} className="space-y-3" key={state?.success}>
      <Field label="Obecne hasło">
        <input name="current" type="password" autoComplete="current-password" required className={inputClass} />
      </Field>
      <Field label="Nowe hasło" hint={`Co najmniej ${MIN_PASSWORD_LENGTH} znaków. Najlepiej kilka słów.`}>
        <input name="password" type="password" autoComplete="new-password" required minLength={MIN_PASSWORD_LENGTH} className={inputClass} />
      </Field>
      <Field label="Powtórz nowe hasło">
        <input name="confirm" type="password" autoComplete="new-password" required className={inputClass} />
      </Field>
      {state?.error && <Alert>{state.error}</Alert>}
      {state?.success && <Alert tone="success">{state.success}</Alert>}
      <Button type="submit" disabled={pending}>Zmień hasło</Button>
    </form>
  );
}
