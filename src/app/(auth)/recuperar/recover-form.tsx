"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/features/auth/actions";
import { initialFormState } from "@/lib/form";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/button";

export function RecoverForm() {
  const [state, action] = useActionState(requestPasswordReset, initialFormState);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      {state.status !== "success" && (
        <>
          <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={state.values?.email} required errors={state.fieldErrors?.email} />
          <SubmitButton className="mt-2 w-full" pendingText="Enviando…">
            Enviar enlace
          </SubmitButton>
        </>
      )}
    </form>
  );
}
