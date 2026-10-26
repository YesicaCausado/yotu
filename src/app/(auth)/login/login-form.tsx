"use client";

import { useActionState } from "react";
import { login } from "@/features/auth/actions";
import { initialFormState } from "@/lib/form";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/button";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(login, initialFormState);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <FormMessage state={state} />
      <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={state.values?.email} required errors={state.fieldErrors?.email} />
      <Field
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        errors={state.fieldErrors?.password}
      />
      <SubmitButton className="mt-2 w-full" pendingText="Entrando…">
        Entrar
      </SubmitButton>
    </form>
  );
}
