"use client";

import { useActionState, useState } from "react";
import { addUser, resetPassword } from "@/app/actions/admin";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-rules";

/** A readable random password the admin can pass on, e.g. "kawa-Rower-lipa-73". */
function generatePassword() {
  const words = ["kawa", "rower", "lipa", "most", "sowa", "kino", "las", "morze", "jabłko", "chmura", "kot", "zegar", "plaża", "góra", "rzeka"];
  const pick = () => words[crypto.getRandomValues(new Uint32Array(1))[0] % words.length];
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 90 + 10;
  return `${pick()}-${pick()}-${pick()}-${n}`;
}

export function AddUserForm() {
  const [state, action, pending] = useActionState(addUser, undefined);
  const [password, setPassword] = useState("");

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2" key={state?.success}>
      <Field label="Imię"><input name="name" required maxLength={60} className={inputClass} /></Field>
      <Field label="E-mail"><input name="email" type="email" required className={inputClass} /></Field>
      <Field label="Hasło startowe" hint={`Co najmniej ${MIN_PASSWORD_LENGTH} znaków`}>
        <div className="flex gap-2">
          <input name="password" required minLength={MIN_PASSWORD_LENGTH} value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete="off" className={`${inputClass} font-mono`} />
          <Button type="button" variant="secondary" onClick={() => setPassword(generatePassword())}>Losuj</Button>
        </div>
      </Field>
      <Field label="Rola">
        <select name="role" defaultValue="member" className={inputClass}>
          <option value="member">Użytkownik</option>
          <option value="admin">Administrator</option>
        </select>
      </Field>
      {state?.error && <div className="sm:col-span-2"><Alert>{state.error}</Alert></div>}
      {state?.success && <div className="sm:col-span-2"><Alert tone="success">{state.success}</Alert></div>}
      <div className="sm:col-span-2"><Button type="submit" disabled={pending}>Utwórz konto</Button></div>
    </form>
  );
}

export function ResetPasswordForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(resetPassword, undefined);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");

  if (!open) return <button className="text-xs text-accent hover:underline" onClick={() => setOpen(true)}>Nowe hasło</button>;
  return (
    <form action={action} className="mt-2 flex w-full flex-wrap gap-2">
      <input type="hidden" name="id" value={id} />
      <input name="password" required minLength={MIN_PASSWORD_LENGTH} value={password} onChange={(e) => setPassword(e.target.value)}
        className={`${inputClass} h-9 max-w-64 font-mono`} aria-label="Nowe hasło" autoComplete="off" />
      <Button type="button" variant="secondary" className="h-9" onClick={() => setPassword(generatePassword())}>Losuj</Button>
      <Button type="submit" className="h-9" disabled={pending}>Ustaw</Button>
      {state?.error && <Alert>{state.error}</Alert>}
      {state?.success && <Alert tone="success">{state.success}</Alert>}
    </form>
  );
}
