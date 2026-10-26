/** Mensajes para los códigos que lanzan las funciones RPC de la base de datos. */
const DB_ERROR_MESSAGES: Record<string, string> = {
  not_authenticated: "Tu sesión ha caducado. Vuelve a iniciar sesión.",
  already_in_couple: "Ya formas parte de una pareja.",
  not_in_couple: "Todavía no formas parte de una pareja.",
  couple_full: "Esta pareja ya está completa.",
  rate_limited: "Has generado demasiadas invitaciones. Inténtalo de nuevo en una hora.",
  invalid_invitation: "Esta invitación no existe o el enlace está incompleto.",
  invitation_revoked: "Esta invitación fue anulada. Pide un enlace nuevo.",
  invitation_used: "Esta invitación ya se utilizó.",
  invitation_expired: "Esta invitación ha caducado. Pide un enlace nuevo.",
  own_invitation: "No puedes aceptar tu propia invitación. Compártela con tu pareja.",
};

export const GENERIC_ERROR = "Algo no salió bien. Inténtalo de nuevo en unos segundos.";

/** Traduce un error de Supabase/PostgREST a un mensaje para la interfaz. */
export function dbErrorMessage(error: { message?: string } | null | undefined) {
  if (!error?.message) return GENERIC_ERROR;
  const code = Object.keys(DB_ERROR_MESSAGES).find((key) => error.message === key || error.message?.includes(key));
  return code ? DB_ERROR_MESSAGES[code] : GENERIC_ERROR;
}

/** Mensajes para errores de Supabase Auth. Evita revelar si un email existe. */
export function authErrorMessage(error: { code?: string; message?: string } | null | undefined) {
  switch (error?.code) {
    case "invalid_credentials":
      return "Email o contraseña incorrectos.";
    case "email_not_confirmed":
      return "Confirma tu email con el enlace que te enviamos antes de entrar.";
    case "weak_password":
      return "La contraseña es demasiado débil. Usa al menos 8 caracteres combinando letras y números.";
    case "same_password":
      return "La nueva contraseña debe ser distinta de la actual.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";
    case "signup_disabled":
      return "El registro está desactivado temporalmente.";
    case "user_already_exists":
    case "email_exists":
      // Mensaje neutro: no confirmar que la cuenta existe.
      return "No se pudo crear la cuenta con ese email. Si ya tienes una, inicia sesión.";
    default:
      return GENERIC_ERROR;
  }
}
