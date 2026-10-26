import type { z } from "zod";

/** Estado devuelto por las Server Actions usadas con useActionState. */
export type FormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /**
   * Valores enviados (nunca contraseñas) para volver a rellenar el formulario:
   * React reinicia los formularios tras ejecutar la acción.
   */
  values?: Record<string, string>;
};

export const initialFormState: FormState = { status: "idle" };

export function errorState(message: string, fieldErrors?: FormState["fieldErrors"]): FormState {
  return { status: "error", message, fieldErrors };
}

export function successState(message: string): FormState {
  return { status: "success", message };
}

export function validationError(error: z.ZodError): FormState {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return errorState("Revisa los campos marcados.", fieldErrors);
}

/** Añade al estado los valores enviados de los campos indicados. */
export function withValues(state: FormState, formData: FormData, keys: string[]): FormState {
  const values: Record<string, string> = {};
  for (const key of keys) {
    const value = formData.get(key);
    if (typeof value === "string") values[key] = value;
  }
  return { ...state, values };
}
