"use client";

import { createClient } from "@/lib/supabase/client";
import { env } from "@/lib/env";
import { safeNextPath } from "@/lib/routes";
import { authErrorMessage } from "@/lib/errors";
import {
  errorState,
  initialFormState,
  successState,
  validationError,
  withValues,
  type FormState,
} from "@/lib/form";
import { loginSchema, newPasswordSchema, recoverSchema, registerSchema } from "@/lib/validation";
import { getUser } from "@/lib/dal";

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return withValues(validationError(parsed.error), formData, ["email"]);

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return errorState(authErrorMessage(error));

  return { ...successState("Sesión iniciada."), redirectTo: safeNextPath(formData.get("next")) };
}

export async function register(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    timezone: formData.get("timezone"),
  });
  if (!parsed.success) return withValues(validationError(parsed.error), formData, ["displayName", "email"]);

  const next = safeNextPath(formData.get("next"));
  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName, timezone: parsed.data.timezone },
      emailRedirectTo: `${env.siteUrl()}/auth/confirm/?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return errorState(authErrorMessage(error));

  if (data.session) return { ...successState("Cuenta creada."), redirectTo: next };

  return successState(
    `Te enviamos un enlace a ${parsed.data.email}. Ábrelo para confirmar tu cuenta y entrar.`,
  );
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = withValues(initialFormState, formData, ["email"]);
  const parsed = recoverSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return withValues(validationError(parsed.error), formData, ["email"]);

  const supabase = createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.siteUrl()}/auth/confirm/?next=/nueva-contrasena`,
  });
  if (error?.code === "over_email_send_rate_limit" || error?.code === "over_request_rate_limit") {
    return errorState(authErrorMessage(error));
  }

  // Respuesta idéntica exista o no la cuenta, para no revelar qué emails están registrados.
  return { ...successState("Si existe una cuenta con ese email, recibirás un enlace para crear una contraseña nueva."), values: values.values };
}

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getUser();
  if (!user) return errorState("Tu sesión ha caducado. Solicita un enlace nuevo.");

  const parsed = newPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return validationError(parsed.error);

  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return errorState(authErrorMessage(error));

  if (formData.get("redirect") === "1") return { ...successState("Contraseña actualizada."), redirectTo: "/inicio" };
  return successState("Contraseña actualizada.");
}

export async function signOut(): Promise<FormState> {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  if (error) return errorState(authErrorMessage(error));
  return { ...successState("Sesión cerrada."), redirectTo: "/login" };
}
