"use client";

import { useActionState } from "react";
import { logoutEverywhere } from "@/app/actions/auth";
import { Alert, Button } from "@/components/ui";

export function SessionsForm() {
  const [state, action, pending] = useActionState(logoutEverywhere, undefined);
  return (
    <form action={action} className="space-y-3">
      <p className="text-sm text-fg-muted">
        Zgubiony telefon albo logowanie na cudzym komputerze? Wyloguj wszystkie inne urządzenia - to zostanie zalogowane.
      </p>
      {state?.success && <Alert tone="success">{state.success}</Alert>}
      <Button type="submit" variant="secondary" disabled={pending}>Wyloguj inne urządzenia</Button>
    </form>
  );
}
