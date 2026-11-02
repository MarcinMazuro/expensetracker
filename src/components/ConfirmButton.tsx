"use client";

import { Button, type ButtonVariant } from "./ui";

/** Submit button that asks first - for actions that cannot be undone. */
export function ConfirmButton({ message, variant = "danger", children }: { message: string; variant?: ButtonVariant; children: React.ReactNode }) {
  return (
    <Button type="submit" variant={variant} onClick={(e) => { if (!confirm(message)) e.preventDefault(); }}>
      {children}
    </Button>
  );
}
