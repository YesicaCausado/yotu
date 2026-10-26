"use client";

import { useActionState, useState } from "react";
import { leaveCouple } from "@/features/couple/actions";
import { initialFormState } from "@/lib/form";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/alert";
import { Button, SubmitButton } from "@/components/ui/button";

export function LeaveCoupleForm() {
  const [state, action] = useActionState(leaveCouple, initialFormState);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        Quiero salir de la pareja
      </Button>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4 animate-fade-in" noValidate>
      <FormMessage state={state} />
      <Field
        label="Escribe SALIR para confirmar"
        name="confirm"
        autoComplete="off"
        autoCapitalize="characters"
        required
        errors={state.fieldErrors?.confirm}
      />
      <div className="flex flex-wrap gap-2">
        <SubmitButton variant="danger" pendingText="Saliendo…">
          Salir definitivamente
        </SubmitButton>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
