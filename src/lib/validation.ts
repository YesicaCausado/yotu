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

const appointmentDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Elige una fecha válida.")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }, "Elige una fecha válida.");
const appointmentTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Elige una hora válida.");
const optionalAppointmentText = (max: number) =>
  z.string().trim().max(max, `Usa como máximo ${max} caracteres.`).transform((value) => value || null);

export const appointmentCategories = ["romantica", "comida", "paseo", "cine", "viaje", "celebracion", "otra"] as const;
export const appointmentStatuses = ["planned", "completed", "cancelled"] as const;
export const budgetModes = ["invites", "accepts_contributions", "split", "shared_budget"] as const;
export const personalActivityCategories = [
  "university",
  "work",
  "study",
  "exercise",
  "errands",
  "family",
  "personal",
  "rest",
  "other",
] as const;
export const activityVisibilities = ["private", "availability", "shared"] as const;
export const activityColors = ["#C66B82", "#6277B8", "#3B8A7B", "#D28B44", "#8564A8", "#4F7D9B"] as const;
export const coupleTalkCategories = ["argument", "upset", "ignored", "distant", "disappointed", "important", "pending", "other"] as const;
export const coupleTalkEmotions = [
  "sadness", "anger", "disappointment", "frustration", "anxiety", "hurt",
  "confusion", "loneliness", "vulnerable", "affection", "calm", "exhausted",
] as const;
export const coupleTalkNeeds = [
  "listen", "affection", "talk", "apology", "love", "space", "agreement", "solution", "understand", "recognize",
] as const;
export const coupleTalkExpectations = [
  "talk_now", "before_sleep", "partner_initiative", "time_to_think", "reconcile", "express_only",
] as const;
export const coupleTalkQuickReplies = ["talk_solve", "affection", "listen", "understand", "think"] as const;

export const coupleTalkEntrySchema = z.object({
  threadId: z.union([z.uuid(), z.literal("")]),
  requestKey: z.uuid(),
  action: z.enum(["draft", "share"]),
  category: z.enum(coupleTalkCategories),
  story: z.string().trim().min(1, "Cuéntanos qué está pasando.").max(6000),
  emotions: z.array(z.enum(coupleTalkEmotions)).min(1, "Elige al menos una emoción."),
  needs: z.array(z.enum(coupleTalkNeeds)).min(1, "Elige al menos una necesidad."),
  expectation: z.enum(coupleTalkExpectations),
  personalMessage: optionalAppointmentText(3000),
});

export const coupleTalkMessageSchema = z.object({
  threadId: z.uuid(),
  requestKey: z.uuid(),
  quickReply: z.union([z.enum(coupleTalkQuickReplies), z.literal("")]),
  body: optionalAppointmentText(3000),
  emotions: z.array(z.enum(coupleTalkEmotions)),
  needs: z.array(z.enum(coupleTalkNeeds)),
}).refine((value) => value.quickReply !== "" || value.body !== null, {
  path: ["body"],
  message: "Elige una respuesta rápida o escribe un mensaje.",
});

export const coupleTalkAgreementSchema = z.object({
  threadId: z.uuid(),
  requestKey: z.uuid(),
  description: z.string().trim().min(1, "Escribe el acuerdo que proponen.").max(2000),
});

export const appointmentSchema = z
  .object({
    title: z.string().trim().min(1, "Escribe el nombre de la cita.").max(100, "Usa como máximo 100 caracteres."),
    description: optionalAppointmentText(3000),
    date: appointmentDate,
    startTime: appointmentTime,
    endTime: z.union([appointmentTime, z.literal("")]).transform((value) => value || null),
    location: optionalAppointmentText(200),
    category: z.enum(appointmentCategories),
    budget: z
      .string()
      .trim()
      .transform((value) => (value === "" ? null : value))
      .refine((value) => value === null || (/^\d{1,8}$/.test(value) && Number(value) <= 99_999_999), "Escribe un presupuesto válido en pesos colombianos.")
      .transform((value) => (value === null ? null : Number(value))),
    budgetMode: z.enum(budgetModes).default("invites"),
    budgetCurrency: z.literal("COP").default("COP"),
    notes: optionalAppointmentText(3000),
    status: z.enum(appointmentStatuses),
    appointmentId: z.union([z.uuid(), z.literal("")]),
    requestKey: z.uuid(),
    imagePath: z.string().max(400),
  })
  .refine((value) => !value.endTime || value.endTime > value.startTime, {
    path: ["endTime"],
    message: "La hora de finalización debe ser posterior al inicio.",
  });

const budgetAmount = z
  .string()
  .trim()
  .regex(/^\d{1,10}$/, "Escribe un valor entero válido en pesos colombianos.")
  .transform(Number)
  .refine((value) => Number.isFinite(value) && value <= 9_999_999_999.99, "El valor excede el máximo permitido.");

export const budgetProposalSchema = z.object({
  appointmentId: z.uuid(),
  requestKey: z.uuid(),
  proposerAmount: budgetAmount,
  recipientAmount: budgetAmount,
  message: optionalAppointmentText(500),
}).refine((value) => value.proposerAmount + value.recipientAmount > 0, {
  path: ["proposerAmount"],
  message: "La propuesta debe incluir al menos un aporte.",
});

export const budgetResponseSchema = z.object({
  proposalId: z.uuid(),
  action: z.enum(["accept", "reject", "counter"]),
  requestKey: z.union([z.uuid(), z.literal("")]),
  proposerAmount: z.string().trim(),
  recipientAmount: z.string().trim(),
  message: optionalAppointmentText(500),
}).transform((value, context) => {
  if (value.action !== "counter") {
    return { ...value, requestKey: null, proposerAmount: null, recipientAmount: null };
  }
  const amounts = z.object({ proposerAmount: budgetAmount, recipientAmount: budgetAmount }).safeParse(value);
  if (!amounts.success) {
    for (const issue of amounts.error.issues) {
      context.addIssue({ code: "custom", path: issue.path, message: issue.message });
    }
    return z.NEVER;
  }
  if (!value.requestKey) {
    context.addIssue({ code: "custom", path: ["requestKey"], message: "Vuelve a enviar la contraoferta." });
    return z.NEVER;
  }
  if (amounts.data.proposerAmount + amounts.data.recipientAmount <= 0) {
    context.addIssue({ code: "custom", path: ["proposerAmount"], message: "La contraoferta debe incluir al menos un aporte." });
    return z.NEVER;
  }
  return { ...value, requestKey: value.requestKey, ...amounts.data };
});

export const appointmentExpenseSchema = z.object({
  appointmentId: z.uuid(),
  requestKey: z.uuid(),
  concept: z.string().trim().min(1, "Escribe el concepto del gasto.").max(120),
  amount: budgetAmount.refine((value) => value > 0, "El gasto debe ser mayor que cero."),
  paidBy: z.uuid(),
  coveredBy: z.uuid(),
});

export const personalActivitySchema = z
  .object({
    activityId: z.union([z.uuid(), z.literal("")]),
    requestKey: z.uuid(),
    title: z.string().trim().min(1, "Escribe el nombre de la actividad.").max(120, "Usa como máximo 120 caracteres."),
    description: optionalAppointmentText(3000),
    activityDate: appointmentDate,
    startTime: appointmentTime,
    endTime: appointmentTime,
    category: z.enum(personalActivityCategories),
    location: optionalAppointmentText(200),
    personalNotes: optionalAppointmentText(3000),
    color: z.enum(activityColors),
    visibility: z.enum(activityVisibilities),
  })
  .refine((value) => value.endTime > value.startTime, {
    path: ["endTime"],
    message: "La hora de finalización debe ser posterior al inicio.",
  });

const optionalLocalDateTime = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(value), "El recordatorio no es válido.")
  .refine((value) => value === "" || appointmentDate.safeParse(value.slice(0, 10)).success, "La fecha del recordatorio no es válida.")
  .transform((value) => (value ? new Date(value).toISOString() : null));

export const personalDayNoteSchema = z.object({
  id: z.union([z.uuid(), z.literal("")]),
  requestKey: z.uuid(),
  noteDate: appointmentDate,
  title: z.string().trim().min(1, "Escribe una nota o pendiente.").max(120, "Usa como máximo 120 caracteres."),
  content: optionalAppointmentText(5000),
  reminderAt: optionalLocalDateTime,
  isTask: z.boolean(),
});

/** Tokens de invitación: 64 caracteres hexadecimales generados por la base de datos. */
export const invitationTokenSchema = z.string().regex(/^[0-9a-f]{64}$/);

/** Ruta de avatar permitida: {userId}/avatar-{marca}.{ext} */
export function isOwnAvatarPath(path: string, userId: string) {
  return new RegExp(`^${userId}/avatar-[0-9a-z]{6,20}\\.(webp|jpg|jpeg|png)$`).test(path);
}
