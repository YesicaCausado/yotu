"use client";

import { useActionState } from "react";
import { updatePassword } from "@/features/auth/actions";
import { initialFormState } from "@/lib/form";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/button";

export function PasswordForm({ redirectAfter = false }: { redirectAfter?: boolean }) {
  const [state, action] = useActionState(updatePassword, initialFormState);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {redirectAfter && <input type="hidden" name="redirect" value="1" />}
      <FormMessage state={state} />
      <Field
        label="Nueva contraseña"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        maxLength={72}
        required
        hint="Mínimo 8 caracteres, con al menos una letra y un número."
        errors={state.fieldErrors?.password}
      />
      <Field
        label="Repite la contraseña"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        errors={state.fieldErrors?.confirmPassword}
      />
      <SubmitButton className="w-full sm:w-auto sm:self-start" pendingText="Guardando…">
        Guardar contraseña
      </SubmitButton>
    </form>
  );
}
