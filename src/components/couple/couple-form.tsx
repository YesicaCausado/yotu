"use client";

import { useActionState } from "react";
import { initialFormState, type FormState } from "@/lib/form";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/button";
import { TimezoneSelect } from "@/components/forms/timezone-select";

type Defaults = { name: string; anniversaryDate: string; timezone: string };

export function CoupleForm({
  action,
  zones,
  defaults,
  submitLabel,
  maxDate,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  zones: string[];
  defaults: Defaults;
  submitLabel: string;
  /** Hoy (AAAA-MM-DD), calculado en el servidor en la zona horaria del usuario. */
  maxDate: string;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const values = { ...defaults, ...state.values };

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <Field
        label="Nombre del espacio (opcional)"
        name="name"
        maxLength={80}
        placeholder="Ana & Bruno"
        defaultValue={values.name}
        errors={state.fieldErrors?.name}
      />
      <Field
        label="Fecha de aniversario (opcional)"
        name="anniversaryDate"
        type="date"
        max={maxDate}
        defaultValue={values.anniversaryDate}
        errors={state.fieldErrors?.anniversaryDate}
      />
      <TimezoneSelect zones={zones} defaultValue={values.timezone} errors={state.fieldErrors?.timezone} label="Zona horaria de la pareja" />
      <SubmitButton className="w-full sm:w-auto sm:self-start" pendingText="Guardando…">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
