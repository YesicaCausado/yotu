import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { asUser, createTestDb, createUser, expectError } from "./helpers";

let db: PGlite;
let ana: string;
let bruno: string;
let carla: string;
let coupleId: string;

async function createCouple(userId: string) {
  const [row] = await asUser<{ id: string }>(db, userId, "select public.create_couple('Calendario') as id");
  return row.id;
}

async function invite(userId: string) {
  const [row] = await asUser<{ token: string }>(db, userId, "select * from public.create_invitation()");
  return row.token;
}

async function saveActivity(
  userId: string,
  requestKey: string,
  title: string,
  visibility: "private" | "availability" | "shared",
  personalNotes = "Apunte privado",
) {
  const [row] = await asUser<{ id: string }>(
    db,
    userId,
    `select public.save_personal_activity(
      null, $1, $2, 'Descripción', '2026-12-24', '08:00', '10:00',
      'work', 'Oficina', $3, '#C66B82', $4
    ) as id`,
    [requestKey, title, personalNotes, visibility],
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

describe("calendario personal y compartido", () => {
  it("oculta actividades privadas y filtra los datos de disponibilidad y compartidas", async () => {
    const privateId = await saveActivity(ana, crypto.randomUUID(), "Cita médica", "private");
    const availabilityId = await saveActivity(ana, crypto.randomUUID(), "Reunión confidencial", "availability");
    const sharedId = await saveActivity(ana, crypto.randomUUID(), "Turno de trabajo", "shared");

    const partnerRows = await asUser<{
      id: string;
      title: string | null;
      description: string | null;
      category: string | null;
      location: string | null;
      personal_notes: string | null;
      visibility: string;
    }>(
      db,
      bruno,
      `select id, title, description, category, location, personal_notes, visibility
       from public.get_calendar_activities('2026-12-24', '2026-12-24')`,
    );

    expect(partnerRows).toHaveLength(2);
    expect(partnerRows.find((row) => row.id === privateId)).toBeUndefined();
    expect(partnerRows.find((row) => row.id === availabilityId)).toMatchObject({
      title: null,
      description: null,
      category: null,
      location: null,
      personal_notes: null,
      visibility: "availability",
    });
    expect(partnerRows.find((row) => row.id === sharedId)).toMatchObject({
      title: "Turno de trabajo",
      description: "Descripción",
      category: "work",
      location: "Oficina",
      personal_notes: null,
      visibility: "shared",
    });
    expect(await expectError(db, bruno, "select * from public.personal_activity_details")).toMatch(/permission denied/);
    expect(await expectError(db, bruno, "select * from public.personal_activities")).toMatch(/permission denied/);
    expect(await asUser(db, ana, "select * from public.get_calendar_activities('2026-12-24', '2026-12-24')")).toHaveLength(3);
  });

  it("limita actividades a la pareja actual y solo permite al dueño editarlas o borrarlas", async () => {
    const activityId = await saveActivity(ana, crypto.randomUUID(), "Estudio", "shared");

    expect(await expectError(
      db,
      bruno,
      "select public.save_personal_activity($1, $2, 'Alterada', null, '2026-12-24', '08:00', '10:00', 'study', null, null, '#C66B82', 'shared')",
      [activityId, crypto.randomUUID()],
    )).toMatch(/personal_activity_not_found/);
    expect(await asUser<{ title: string }>(db, ana, "select title from public.get_calendar_activities('2026-12-24', '2026-12-24') where id = $1", [activityId]))
      .toEqual([{ title: "Estudio" }]);

    const otherCouple = await createCouple(carla);
    expect(await asUser(db, carla, "select * from public.get_calendar_activities('2026-12-24', '2026-12-24')")).toEqual([]);
    expect(await expectError(db, bruno, "select public.delete_personal_activity($1)", [activityId]))
      .toMatch(/personal_activity_not_found/);
    expect(await asUser(db, ana, "select id from public.get_calendar_activities('2026-12-24', '2026-12-24') where id = $1", [activityId]))
      .toEqual([{ id: activityId }]);
    expect(otherCouple).not.toBe(coupleId);
    expect(await expectError(db, null, "select * from public.get_calendar_activities('2026-12-24', '2026-12-24')"))
      .toMatch(/permission denied/);
  });

  it("evita duplicados, sincroniza solo cambios visibles y oculta un evento al volverlo privado", async () => {
    const requestKey = crypto.randomUUID();
    const activityId = await saveActivity(ana, requestKey, "Trabajo", "shared");
    const [beforePrivate] = await asUser<{ version: number }>(
      db,
      ana,
      "select version from public.calendar_sync_state where couple_id = $1",
      [coupleId],
    );
    expect(await saveActivity(ana, requestKey, "Otra copia", "shared")).toBe(activityId);
    await asUser(
      db,
      ana,
      `select public.save_personal_activity(
        $1, $2, 'Trabajo', 'Descripción', '2026-12-24', '08:00', '10:00',
        'work', 'Oficina', 'Nota privada editada', '#C66B82', 'shared'
      )`,
      [activityId, requestKey],
    );

    const privateId = await saveActivity(ana, crypto.randomUUID(), "Descanso", "private");
    const [afterPrivate] = await asUser<{ version: number }>(
      db,
      ana,
      "select version from public.calendar_sync_state where couple_id = $1",
      [coupleId],
    );
    expect(afterPrivate.version).toBe(beforePrivate.version);
    expect(await asUser(db, bruno, "select id from public.get_calendar_activities('2026-12-24', '2026-12-24') where id = $1", [privateId]))
      .toEqual([]);

    await asUser(
      db,
      ana,
      `select public.save_personal_activity(
        $1, $2, 'Trabajo', 'Descripción', '2026-12-24', '08:00', '10:00',
        'work', 'Oficina', 'Apunte privado', '#C66B82', 'private'
      )`,
      [activityId, requestKey],
    );
    const [afterHide] = await asUser<{ version: number }>(
      db,
      ana,
      "select version from public.calendar_sync_state where couple_id = $1",
      [coupleId],
    );
    expect(afterHide.version).toBeGreaterThan(afterPrivate.version);
    expect(await asUser(db, bruno, "select id from public.get_calendar_activities('2026-12-24', '2026-12-24') where id = $1", [activityId]))
      .toEqual([]);
  });

  it("mantiene notas y pendientes diarios privados para su creador", async () => {
    const [note] = await asUser<{ id: string }>(
      db,
      ana,
      `insert into public.personal_day_notes (request_key, note_date, title, content, is_task)
       values ($1, '2026-12-24', 'Comprar regalo', 'Antes de salir', true)
       returning id`,
      [crypto.randomUUID()],
    );

    expect(await asUser<{ title: string; is_task: boolean }>(
      db,
      ana,
      "select title, is_task from public.personal_day_notes where id = $1",
      [note.id],
    )).toEqual([{ title: "Comprar regalo", is_task: true }]);
    expect(await asUser(db, bruno, "select * from public.personal_day_notes")).toEqual([]);

    await asUser(db, bruno, "update public.personal_day_notes set title = 'Robada' where id = $1", [note.id]);
    await asUser(db, bruno, "delete from public.personal_day_notes where id = $1", [note.id]);
    expect(await asUser<{ title: string }>(db, ana, "select title from public.personal_day_notes where id = $1", [note.id]))
      .toEqual([{ title: "Comprar regalo" }]);
    expect(await expectError(db, null, "select * from public.personal_day_notes")).toMatch(/permission denied/);
  });
});
