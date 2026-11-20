import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { asUser, createTestDb, createUser, expectError } from "./helpers";

let db: PGlite;
let ana: string;
let bruno: string;
let carla: string;
let coupleId: string;
let appointmentId: string;

async function createCouple(userId: string) {
  const [row] = await asUser<{ id: string }>(db, userId, "select public.create_couple('Nosotros') as id");
  return row.id;
}

async function invite(userId: string) {
  const [row] = await asUser<{ token: string }>(db, userId, "select * from public.create_invitation()");
  return row.token;
}

async function addAppointment(userId: string, couple: string) {
  const [row] = await asUser<{ id: string }>(
    db,
    userId,
    `insert into public.appointments
      (couple_id, request_key, title, date, start_time, category, budget, budget_mode)
     values ($1, gen_random_uuid(), 'Cena especial', '2026-12-24', '18:30', 'romantica', 100000, 'split')
     returning id`,
    [couple],
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
  appointmentId = await addAppointment(ana, coupleId);
});

describe("presupuestos voluntarios para citas", () => {
  it("una propuesta requiere aceptación y solo entonces actualiza el acuerdo visible para ambos", async () => {
    const [proposal] = await asUser<{ id: string }>(
      db,
      ana,
      `select public.create_appointment_budget_proposal($1, gen_random_uuid(), 70000, 30000, 'Como te quede cómodo') as id`,
      [appointmentId],
    );
    expect(await asUser(db, ana, "select appointment_id from public.appointment_budget_agreements")).toEqual([]);

    await asUser(db, bruno,
      "select public.respond_to_appointment_budget_proposal($1, 'accept', null, null, null, null)",
      [proposal.id],
    );
    const agreement = await asUser(db, bruno, "select first_user_id, first_amount, second_user_id, second_amount, total_amount from public.appointment_budget_agreements");
    expect(agreement).toEqual([{
      first_user_id: ana,
      first_amount: "70000.00",
      second_user_id: bruno,
      second_amount: "30000.00",
      total_amount: "100000.00",
    }]);
    expect(await asUser(db, ana, "select status from public.appointment_budget_proposals where id = $1", [proposal.id]))
      .toEqual([{ status: "accepted" }]);
  });

  it("registra contraofertas como historial y prohíbe cambios directos al acuerdo", async () => {
    const [first] = await asUser<{ id: string }>(
      db,
      ana,
      "select public.create_appointment_budget_proposal($1, gen_random_uuid(), 70000, 30000, null) as id",
      [appointmentId],
    );
    const [counter] = await asUser<{ id: string }>(
      db,
      bruno,
      `select public.respond_to_appointment_budget_proposal(
        $1, 'counter', gen_random_uuid(), 40000, 60000, 'Así nos queda mejor'
      ) as id`,
      [first.id],
    );
    await asUser(db, ana,
      "select public.respond_to_appointment_budget_proposal($1, 'accept', null, null, null, null)",
      [counter.id],
    );

    expect(await asUser(db, ana, "select status from public.appointment_budget_proposals order by created_at"))
      .toEqual([{ status: "countered" }, { status: "accepted" }]);
    expect(await asUser(db, bruno, "select first_user_id, first_amount, second_user_id, second_amount from public.appointment_budget_agreements"))
      .toEqual([{ first_user_id: bruno, first_amount: "40000.00", second_user_id: ana, second_amount: "60000.00" }]);
    expect(await expectError(db, ana, "update public.appointment_budget_agreements set first_amount = 1"))
      .toMatch(/permission denied/);
    expect(await expectError(db, ana,
      "update public.appointments set budget_mode = 'invites' where id = $1",
      [appointmentId],
    )).toMatch(/budget_agreement_requires_new_proposal/);
  });

  it("solo una nueva propuesta aceptada puede modificar el acuerdo anterior", async () => {
    const [first] = await asUser<{ id: string }>(
      db,
      ana,
      "select public.create_appointment_budget_proposal($1, gen_random_uuid(), 80000, 20000, null) as id",
      [appointmentId],
    );
    await asUser(db, bruno,
      "select public.respond_to_appointment_budget_proposal($1, 'accept', null, null, null, null)",
      [first.id],
    );
    const [second] = await asUser<{ id: string }>(
      db,
      bruno,
      "select public.create_appointment_budget_proposal($1, gen_random_uuid(), 45000, 55000, null) as id",
      [appointmentId],
    );
    expect(await asUser(db, ana, "select first_amount, second_amount from public.appointment_budget_agreements"))
      .toEqual([{ first_amount: "80000.00", second_amount: "20000.00" }]);
    await asUser(db, ana,
      "select public.respond_to_appointment_budget_proposal($1, 'accept', null, null, null, null)",
      [second.id],
    );
    expect(await asUser(db, bruno, "select first_user_id, first_amount, second_user_id, second_amount from public.appointment_budget_agreements"))
      .toEqual([{ first_user_id: bruno, first_amount: "45000.00", second_user_id: ana, second_amount: "55000.00" }]);
  });

  it("rechaza accesos de otras parejas y evita aceptar propuestas ajenas", async () => {
    const [proposal] = await asUser<{ id: string }>(
      db,
      ana,
      "select public.create_appointment_budget_proposal($1, gen_random_uuid(), 50000, 50000, null) as id",
      [appointmentId],
    );
    await createCouple(carla);
    expect(await asUser(db, carla, "select id from public.appointment_budget_proposals")).toEqual([]);
    expect(await expectError(db, carla,
      "select public.respond_to_appointment_budget_proposal($1, 'accept', null, null, null, null)",
      [proposal.id],
    )).toMatch(/budget_proposal_not_found/);
    expect(await expectError(db, carla,
      `insert into public.appointment_budget_proposals
        (appointment_id, couple_id, request_key, proposer_id, recipient_id, proposer_amount, recipient_amount)
       values ($1, $2, gen_random_uuid(), $3, $4, 1, 1)`,
      [appointmentId, coupleId, carla, bruno],
    )).toMatch(/permission denied/);
  });

  it("registra gastos idempotentes, audita pagador y responsable, y notifica cambios de estimado", async () => {
    const requestKey = crypto.randomUUID();
    const [first] = await asUser<{ id: string }>(
      db,
      ana,
      `select public.add_appointment_expense($1, $2, 'Cena', 85000, $3, $4) as id`,
      [appointmentId, requestKey, ana, bruno],
    );
    const [retry] = await asUser<{ id: string }>(
      db,
      ana,
      `select public.add_appointment_expense($1, $2, 'Cena', 85000, $3, $4) as id`,
      [appointmentId, requestKey, ana, bruno],
    );
    expect(retry.id).toBe(first.id);
    expect(await asUser(db, bruno, "select concept, amount, paid_by, covered_by from public.appointment_expenses"))
      .toEqual([{ concept: "Cena", amount: "85000.00", paid_by: ana, covered_by: bruno }]);
    expect(await expectError(db, ana,
      `insert into public.appointment_expenses
        (appointment_id, couple_id, request_key, concept, amount, paid_by, covered_by)
       values ($1, $2, gen_random_uuid(), 'Directo', 1, $3, $4)`,
      [appointmentId, coupleId, ana, bruno],
    )).toMatch(/permission denied/);

    await asUser(db, ana, "update public.appointments set budget = 120000 where id = $1", [appointmentId]);
    expect(await asUser(db, bruno, "select event_type from public.appointment_budget_notifications"))
      .toEqual([{ event_type: "budget_updated" }]);
    expect(await asUser(db, carla, "select id from public.appointment_expenses")).toEqual([]);
  });

  it("notifica al recibir, rechazar y aceptar propuestas sin crear obligación automática", async () => {
    const [proposal] = await asUser<{ id: string }>(
      db,
      ana,
      "select public.create_appointment_budget_proposal($1, gen_random_uuid(), 100000, 0, null) as id",
      [appointmentId],
    );
    expect(await asUser(db, bruno, "select event_type from public.appointment_budget_notifications"))
      .toEqual([{ event_type: "proposal_received" }]);

    await asUser(db, bruno,
      "select public.respond_to_appointment_budget_proposal($1, 'reject', null, null, null, null)",
      [proposal.id],
    );
    expect(await asUser(db, ana, "select event_type from public.appointment_budget_notifications order by created_at"))
      .toEqual([{ event_type: "proposal_rejected" }]);
    expect(await asUser(db, ana, "select appointment_id from public.appointment_budget_agreements")).toEqual([]);
  });
});
