import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { asUser, createTestDb, createUser, expectError } from "./helpers";

let db: PGlite;
let creator: string;
let partner: string;
let outsider: string;
let coupleId: string;

async function createCouple(userId: string) {
  const [row] = await asUser<{ id: string }>(db, userId, "select public.create_couple('Nosotros') as id");
  return row.id;
}

async function invite(userId: string) {
  const [row] = await asUser<{ token: string }>(db, userId, "select * from public.create_invitation()");
  return row.token;
}

beforeEach(async () => {
  db = await createTestDb();
  creator = await createUser(db, "creador@example.com");
  partner = await createUser(db, "pareja@example.com");
  outsider = await createUser(db, "externo@example.com");
  coupleId = await createCouple(creator);
  await asUser(db, partner, "select public.accept_invitation($1)", [await invite(creator)]);
});

describe("citas sorpresa", () => {
  it("mantiene los detalles ocultos al miembro receptor hasta reveal_at", async () => {
    const coverPath = `${coupleId}/${creator}/surprise-cover-12345678-1234-1234-1234-123456789abc.jpg`;
    const [surprise] = await asUser<{ id: string }>(
      db,
      creator,
      `select public.create_or_update_surprise_appointment(
        null, gen_random_uuid(), 'Cena bajo las estrellas', 'Un plan secreto',
        current_date + 2, '19:00', null, now() + interval '1 hour',
        'Jardín secreto', 'romantica', $1, 'Lleva algo abrigado'
      ) as id`,
      [coverPath],
    );

    expect(await asUser<{ title: string; location: string | null; image_path: string | null }>(
      db,
      partner,
      "select title, location, image_path from public.appointments where id = $1",
      [surprise.id],
    )).toEqual([{ title: "Sorpresa pendiente", location: null, image_path: null }]);
    expect(await asUser(db, partner, "select title, location, image_path from public.appointment_surprise_details where appointment_id = $1", [surprise.id])).toEqual([]);
    expect(await asUser<{ title: string; image_path: string }>(
      db,
      creator,
      "select title, image_path from public.appointment_surprise_details where appointment_id = $1",
      [surprise.id],
    )).toEqual([{ title: "Cena bajo las estrellas", image_path: coverPath }]);
    expect(await asUser<{ event_type: string }>(
      db,
      partner,
      "select event_type from public.appointment_surprise_notifications where appointment_id = $1",
      [surprise.id],
    )).toEqual([{ event_type: "surprise_received" }]);

    await asUser(db, creator, "insert into storage.objects (bucket_id, name) values ('surprise-covers', $1)", [coverPath]);
    expect(await asUser(db, partner, "select name from storage.objects where bucket_id = 'surprise-covers'")).toEqual([]);
    expect(await asUser(db, outsider, "select title from public.appointment_surprise_details")).toEqual([]);
    expect(await expectError(
      db,
      partner,
      "update public.appointment_surprise_details set title = 'Revelada' where appointment_id = $1",
      [surprise.id],
    )).toMatch(/permission denied/);
    expect(await asUser(db, partner, "update public.appointments set title = 'Adiviné' where id = $1", [surprise.id])).toEqual([]);

    await db.query("update public.appointments set reveal_at = now() - interval '1 minute' where id = $1", [surprise.id]);
    expect(await asUser<{ title: string }>(
      db,
      partner,
      "select title from public.appointment_surprise_details where appointment_id = $1",
      [surprise.id],
    )).toEqual([{ title: "Cena bajo las estrellas" }]);
    expect(await asUser<{ name: string }>(
      db,
      partner,
      "select name from storage.objects where bucket_id = 'surprise-covers'",
    )).toEqual([{ name: coverPath }]);
    await asUser(db, partner, "select public.sync_appointment_surprise_notifications()");
    expect(await asUser<{ event_type: string }>(
      db,
      partner,
      "select event_type from public.appointment_surprise_notifications where appointment_id = $1 order by event_type",
      [surprise.id],
    )).toContainEqual({ event_type: "surprise_revealed" });
  });

  it("rechaza datos fuera de la pareja y fechas de revelación inválidas", async () => {
    expect(await expectError(
      db,
      outsider,
      `select public.create_or_update_surprise_appointment(
        null, gen_random_uuid(), 'Cena', null, current_date + 2, '19:00', null,
        now() + interval '1 hour', null, 'romantica', null, null
      )`,
    )).toMatch(/not_in_couple|invalid_surprise_appointment/);
    expect(await expectError(
      db,
      creator,
      `select public.create_or_update_surprise_appointment(
        null, gen_random_uuid(), 'Cena', null, current_date + 2, '19:00', null,
        now() + interval '4 days', null, 'romantica', null, null
      )`,
    )).toMatch(/reveal_after_appointment/);
  });

  it("permite al creador editar los detalles privados antes de revelar", async () => {
    const [surprise] = await asUser<{ id: string }>(
      db,
      creator,
      `select public.create_or_update_surprise_appointment(
        null, gen_random_uuid(), 'Cena inicial', null, current_date + 2, '19:00', null,
        now() + interval '1 hour', null, 'romantica', null, null
      ) as id`,
    );
    await asUser(
      db,
      creator,
      `select public.create_or_update_surprise_appointment(
        $1, gen_random_uuid(), 'Cena renovada', 'Nuevos detalles',
        current_date + 2, '20:00', null, now() + interval '90 minutes',
        'Terraza', 'comida', null, null
      )`,
      [surprise.id],
    );
    expect(await asUser<{ title: string; location: string }>(
      db,
      creator,
      "select title, location from public.appointment_surprise_details where appointment_id = $1",
      [surprise.id],
    )).toEqual([{ title: "Cena renovada", location: "Terraza" }]);
    expect(await asUser(
      db,
      partner,
      "select title from public.appointment_surprise_details where appointment_id = $1",
      [surprise.id],
    )).toEqual([]);
    expect(await expectError(
      db,
      partner,
      `select public.create_or_update_surprise_appointment(
        $1, gen_random_uuid(), 'Intento', null, current_date + 2, '19:00', null,
        now() + interval '1 hour', null, 'romantica', null, null
      )`,
      [surprise.id],
    )).toMatch(/surprise_not_found_or_revealed/);
  });
});
