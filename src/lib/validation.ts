import { z } from "zod";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Escribe tu email.")
  .max(254, "El email es demasiado largo.")
  .pipe(z.email("Escribe un email válido."));

const password = z
  .string()
  .min(8, "Usa al menos 8 caracteres.")
  .max(72, "Usa como máximo 72 caracteres.")
  .regex(/[A-Za-zÀ-ÿ]/, "Incluye al menos una letra.")
  .regex(/\d/, "Incluye al menos un número.");

const displayName = z
  .string()
  .trim()
  .min(1, "Escribe cómo quieres que te llamen.")
  .max(60, "Usa como máximo 60 caracteres.");

export function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const timezone = z
  .string()
  .trim()
  .max(64)
  .refine(isValidTimeZone, "Zona horaria no válida.");

/** Fecha opcional en formato AAAA-MM-DD (input type="date"). Vacío = null. */
const optionalDate = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`))), "Fecha no válida.")
  .refine((v) => v === null || v >= "1900-01-01", "Fecha no válida.")
  .nullable();

// Margen de un día: "hoy" en zonas como Asia/Tokyo ya es mañana en UTC.
const pastOrTodayDate = optionalDate.refine(
  (v) => v === null || v <= new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
  "La fecha no puede estar en el futuro.",
);

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Escribe tu contraseña.").max(72),
});

export const registerSchema = z
  .object({
    displayName,
    email,
    password,
    confirmPassword: z.string(),
    timezone: timezone.catch("UTC"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Las contraseñas no coinciden.",
  });

export const recoverSchema = z.object({ email });

export const newPasswordSchema = z
  .object({ password, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Las contraseñas no coinciden.",
  });

export const profileSchema = z.object({
  displayName,
  birthday: pastOrTodayDate,
  timezone,
});

export const coupleSchema = z.object({
  name: z
    .string()
    .trim()
    .max(80, "Usa como máximo 80 caracteres.")
    .transform((v) => (v === "" ? null : v)),
  anniversaryDate: pastOrTodayDate,
  timezone,
});

/** Tokens de invitación: 64 caracteres hexadecimales generados por la base de datos. */
export const invitationTokenSchema = z.string().regex(/^[0-9a-f]{64}$/);

/** Ruta de avatar permitida: {userId}/avatar-{marca}.{ext} */
export function isOwnAvatarPath(path: string, userId: string) {
  return new RegExp(`^${userId}/avatar-[0-9a-z]{6,20}\\.(webp|jpg|jpeg|png)$`).test(path);
}
