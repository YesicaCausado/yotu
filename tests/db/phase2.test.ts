import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { asUser, createTestDb, createUser, expectError } from "./helpers";

let db: PGlite;
let ana: string;
let bruno: string;
let carla: string;
let coupleId: string;

async function createCouple(userId: string) {
  const [row] = await asUser<{ id: string }>(db, userId, "select public.create_couple('Nosotros') as id");
  return row.id;
}

async function invite(userId: string) {
  const [row] = await asUser<{ token: string }>(db, userId, "select * from public.create_invitation()");
  return row.token;
}

async function addAppointment(userId: string, couple: string, requestKey = crypto.randomUUID()) {
  const [row] = await asUser<{ id: string }>(
    db,
    userId,
    `insert into public.appointments
      (couple_id, request_key, title, date, start_time, category)
     values ($1, $2, 'Cena especial', '2026-12-24', '18:30', 'romantica')
     returning id`,
    [couple, requestKey],
  );
  return row.id;
}

beforeEach(async () => {
  db = await createTestDb();
  ana = await createUser(db, "ana@example.com");
  bruno = await createUser(db, "bruno@example.com");
  carla = await createUser(db, "carla@example.com");
  coupleId = await createCouple(ana);
  await asUser(db, bruno, "select public.accept_invitation($1)", [await invite(ana)]);
});

describe("citas compartidas", () => {
  it("ambos integrantes pueden consultar, editar y eliminar la misma cita", async () => {
    const appointmentId = await addAppointment(ana, coupleId);
    const shared = await asUser<{ title: string; created_by: string }>(
      db,
      bruno,
      "select title, created_by from public.appointments where id = $1",
      [appointmentId],
    );
    expect(shared).toEqual([{ title: "Cena especial", created_by: ana }]);

    await asUser(db, bruno, "update public.appointments set location = 'París', status = 'completed' where id = $1", [appointmentId]);
    const [updated] = await asUser<{ location: string; status: string }>(
      db,
      ana,
      "select location, status from public.appointments where id = $1",
      [appointmentId],
    );
    expect(updated).toEqual({ location: "París", status: "completed" });

    await asUser(db, bruno, "delete from public.appointments where id = $1", [appointmentId]);
    expect(await asUser(db, ana, "select id from public.appointments where id = $1", [appointmentId])).toEqual([]);
  });

  it("aísla citas de otras parejas y bloquea escrituras cruzadas", async () => {
    const appointmentId = await addAppointment(ana, coupleId);
    const otherCouple = await createCouple(carla);
    expect(await asUser(db, carla, "select id from public.appointments")).toEqual([]);

    await asUser(db, carla, "update public.appointments set title = 'Ajena' where id = $1", [appointmentId]);
    expect(await asUser(db, carla, "delete from public.appointments where id = $1", [appointmentId])).toEqual([]);
    expect(await expectError(
      db,
      carla,
      `insert into public.appointments (couple_id, request_key, title, date, start_time, category)
       values ($1, gen_random_uuid(), 'Intrusa', '2026-12-24', '18:30', 'romantica')`,
      [coupleId],
    )).toMatch(/row-level security/);
    expect(await asUser(db, ana, "select id from public.appointments")).toEqual([{ id: appointmentId }]);
    expect(otherCouple).not.toBe(coupleId);
  });

  it("evita reintentos duplicados y valida fechas y horas", async () => {
    const requestKey = crypto.randomUUID();
    await addAppointment(ana, coupleId, requestKey);
    expect(await expectError(db, ana,
      `insert into public.appointments (couple_id, request_key, title, date, start_time, category)
       values ($1, $2, 'Duplicada', '2026-12-24', '18:30', 'romantica')`,
      [coupleId, requestKey],
    )).toMatch(/unique constraint/);

    expect(await expectError(db, ana,
      `insert into public.appointments (couple_id, request_key, title, date, start_time, end_time, category)
       values ($1, gen_random_uuid(), 'Hora inválida', '2026-12-24', '19:00', '18:00', 'romantica')`,
      [coupleId],
    )).toMatch(/check constraint/);
  });

  it("solo integrantes pueden usar las portadas privadas de su pareja", async () => {
    const path = `${coupleId}/appointment-cover-12345678-1234-1234-1234-123456789abc.jpg`;
    await asUser(db, ana, "insert into storage.objects (bucket_id, name) values ('appointment-covers', $1)", [path]);
    expect(await asUser<{ name: string }>(db, bruno, "select name from storage.objects")).toEqual([{ name: path }]);
    expect(await asUser(db, carla, "select name from storage.objects")).toEqual([]);
    expect(await expectError(
      db,
      carla,
      "insert into storage.objects (bucket_id, name) values ('appointment-covers', $1)",
      [path],
    )).toMatch(/row-level security/);
  });

  it("anon no puede consultar ni crear citas", async () => {
    expect(await expectError(db, null, "select * from public.appointments")).toMatch(/permission denied/);
    expect(await expectError(db, null,
      `insert into public.appointments (couple_id, request_key, title, date, start_time, category)
       values ($1, gen_random_uuid(), 'Sin sesión', '2026-12-24', '18:30', 'romantica')`,
      [coupleId],
    )).toMatch(/permission denied/);
  });
});
