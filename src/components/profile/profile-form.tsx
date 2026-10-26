"use client";

import { useActionState } from "react";
import { updateProfile } from "@/features/profile/actions";
import { initialFormState } from "@/lib/form";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/button";
import { TimezoneSelect } from "@/components/forms/timezone-select";

export function ProfileForm({
  zones,
  defaults,
  maxDate,
}: {
  zones: string[];
  defaults: { displayName: string; birthday: string; timezone: string };
  maxDate: string;
}) {
  const [state, action] = useActionState(updateProfile, initialFormState);
  const values = { ...defaults, ...state.values };

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <Field
        label="Nombre"
        name="displayName"
        maxLength={60}
        required
        defaultValue={values.displayName}
        errors={state.fieldErrors?.displayName}
      />
      <Field
        label="Cumpleaños (opcional)"
        name="birthday"
        type="date"
        max={maxDate}
        defaultValue={values.birthday}
        errors={state.fieldErrors?.birthday}
      />
      <TimezoneSelect zones={zones} defaultValue={values.timezone} errors={state.fieldErrors?.timezone} />
      <SubmitButton className="w-full sm:w-auto sm:self-start" pendingText="Guardando…">
        Guardar perfil
      </SubmitButton>
    </form>
  );
}
