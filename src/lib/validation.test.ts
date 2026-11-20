import { describe, expect, it } from "vitest";
import {
  appointmentSchema,
  appointmentExpenseSchema,
  budgetProposalSchema,
  budgetResponseSchema,
  coupleSchema,
  invitationTokenSchema,
  isOwnAvatarPath,
  profileSchema,
  registerSchema,
} from "./validation";

const uid = "3f1c1c9e-8d7a-4c7b-9a51-2b7f4f3a9d10";

describe("registerSchema", () => {
  const valid = {
    displayName: " Ana ",
    email: " Ana@Example.com ",
    password: "secreto123",
    confirmPassword: "secreto123",
    timezone: "Europe/Madrid",
  };

  it("normaliza email y nombre", () => {
    const parsed = registerSchema.parse(valid);
    expect(parsed.email).toBe("ana@example.com");
    expect(parsed.displayName).toBe("Ana");
  });

  it("exige contraseñas coincidentes y robustas", () => {
    expect(registerSchema.safeParse({ ...valid, confirmPassword: "otra12345" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, password: "corta1", confirmPassword: "corta1" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, password: "solo-letras", confirmPassword: "solo-letras" }).success).toBe(false);
  });

  it("usa UTC si la zona horaria no es válida", () => {
    expect(registerSchema.parse({ ...valid, timezone: "Marte/Base" }).timezone).toBe("UTC");
  });
});

describe("profileSchema", () => {
  it("acepta cumpleaños vacío y rechaza fechas futuras o mal formadas", () => {
    expect(profileSchema.parse({ displayName: "Ana", birthday: "", timezone: "UTC" }).birthday).toBeNull();
    expect(profileSchema.safeParse({ displayName: "Ana", birthday: "2999-01-01", timezone: "UTC" }).success).toBe(false);
    expect(profileSchema.safeParse({ displayName: "Ana", birthday: "14/02/2000", timezone: "UTC" }).success).toBe(false);
  });
});

describe("coupleSchema", () => {
  it("convierte el nombre vacío en null", () => {
    expect(coupleSchema.parse({ name: "  ", anniversaryDate: "", timezone: "UTC" })).toEqual({
      name: null,
      anniversaryDate: null,
      timezone: "UTC",
    });
  });
});

describe("appointmentSchema", () => {
  const valid = {
    title: "Cena juntos",
    description: "",
    date: "2026-12-24",
    startTime: "18:30",
    endTime: "20:00",
    location: "",
    category: "romantica",
    budget: "125",
    notes: "",
    status: "planned",
    appointmentId: "",
    requestKey: "3f1c1c9e-8d7a-4c7b-9a51-2b7f4f3a9d10",
    imagePath: "",
  };

  it("normaliza campos opcionales y acepta una cita válida", () => {
    expect(appointmentSchema.parse(valid)).toMatchObject({
      description: null,
      location: null,
      budget: 125,
      budgetMode: "invites",
      budgetCurrency: "COP",
      notes: null,
    });
  });

  it("rechaza fechas imposibles, horas invertidas y presupuestos negativos", () => {
    expect(appointmentSchema.safeParse({ ...valid, date: "2026-02-31" }).success).toBe(false);
    expect(appointmentSchema.safeParse({ ...valid, endTime: "18:00" }).success).toBe(false);
    expect(appointmentSchema.safeParse({ ...valid, budget: "-10" }).success).toBe(false);
    expect(appointmentSchema.safeParse({ ...valid, budget: "125.50" }).success).toBe(false);
  });

  it("valida las modalidades económicas de la cita", () => {
    expect(appointmentSchema.safeParse({ ...valid, budgetMode: "split" }).success).toBe(true);
    expect(appointmentSchema.safeParse({ ...valid, budgetMode: "unknown" }).success).toBe(false);
    expect(appointmentSchema.safeParse({ ...valid, budgetCurrency: "USD" }).success).toBe(false);
  });
});

describe("validaciones del presupuesto compartido", () => {
  const proposal = {
    appointmentId: uid,
    requestKey: uid,
    proposerAmount: "70000",
    recipientAmount: "30000",
    message: "Si te queda cómodo",
  };

  it("acepta propuestas voluntarias y rechaza valores inválidos o reparto nulo", () => {
    expect(budgetProposalSchema.parse(proposal).proposerAmount).toBe(70000);
    expect(budgetProposalSchema.safeParse({ ...proposal, proposerAmount: "-1" }).success).toBe(false);
    expect(budgetProposalSchema.safeParse({ ...proposal, proposerAmount: "0", recipientAmount: "0" }).success).toBe(false);
  });

  it("solo requiere nuevos montos para contraofertar", () => {
    expect(budgetResponseSchema.parse({
      proposalId: uid,
      action: "accept",
      requestKey: "",
      proposerAmount: "",
      recipientAmount: "",
      message: "",
    })).toMatchObject({ action: "accept", proposerAmount: null, recipientAmount: null });
    expect(budgetResponseSchema.safeParse({
      proposalId: uid,
      action: "counter",
      requestKey: uid,
      proposerAmount: "40000",
      recipientAmount: "60000",
      message: "",
    }).success).toBe(true);
    expect(budgetResponseSchema.safeParse({
      proposalId: uid,
      action: "counter",
      requestKey: "",
      proposerAmount: "0",
      recipientAmount: "0",
      message: "",
    }).success).toBe(false);
  });

  it("valida cada gasto y quién lo pagó y asumió", () => {
    const expense = {
      appointmentId: uid,
      requestKey: uid,
      concept: "Cena",
      amount: "85000",
      paidBy: uid,
      coveredBy: uid,
    };
    expect(appointmentExpenseSchema.parse(expense).amount).toBe(85000);
    expect(appointmentExpenseSchema.safeParse({ ...expense, amount: "0" }).success).toBe(false);
  });
});

describe("tokens y rutas", () => {
  it("solo acepta tokens de 64 hex", () => {
    expect(invitationTokenSchema.safeParse("a".repeat(64)).success).toBe(true);
    expect(invitationTokenSchema.safeParse("a".repeat(63)).success).toBe(false);
    expect(invitationTokenSchema.safeParse("' or 1=1 --").success).toBe(false);
  });

  it("solo acepta rutas de avatar dentro de la carpeta propia", () => {
    expect(isOwnAvatarPath(`${uid}/avatar-k2j3h4l5.webp`, uid)).toBe(true);
    expect(isOwnAvatarPath(`otro-id/avatar-k2j3h4l5.webp`, uid)).toBe(false);
    expect(isOwnAvatarPath(`${uid}/../x/avatar-k2j3h4l5.webp`, uid)).toBe(false);
    expect(isOwnAvatarPath(`${uid}/avatar-k2j3h4l5.svg`, uid)).toBe(false);
  });
});
