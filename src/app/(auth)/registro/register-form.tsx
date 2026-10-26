"use client";

import { useActionState, useSyncExternalStore } from "react";
import { MailCheck } from "lucide-react";
import { register } from "@/features/auth/actions";
import { initialFormState } from "@/lib/form";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

const noopSubscribe = () => () => {};

export function RegisterForm({ next }: { next: string }) {
  const [state, action] = useActionState(register, initialFormState);
  // Zona horaria del dispositivo; se puede cambiar después en el perfil.
  const timezone = useSyncExternalStore(
    noopSubscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    () => "UTC",
  );

  if (state.status === "success") {
    return <EmptyState icon={MailCheck} title="Revisa tu correo" description={state.message} />;
  }

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="timezone" value={timezone} />
      <FormMessage state={state} />
      <Field
        label="¿Cómo quieres que te llamen?"
        name="displayName"
        autoComplete="nickname"
        defaultValue={state.values?.displayName}
        maxLength={60}
        required
        errors={state.fieldErrors?.displayName}
      />
      <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={state.values?.email} required errors={state.fieldErrors?.email} />
      <Field
        label="Contraseña"
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
      <SubmitButton className="mt-2 w-full" pendingText="Creando cuenta…">
        Crear cuenta
      </SubmitButton>
    </form>
  );
}
