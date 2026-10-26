import { describe, expect, it } from "vitest";
import { coupleSchema, invitationTokenSchema, isOwnAvatarPath, profileSchema, registerSchema } from "./validation";

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
