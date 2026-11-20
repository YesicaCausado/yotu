import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { asUser, createTestDb, createUser, expectError } from "./helpers";

let db: PGlite;
let ana: string;
let bruno: string;
let carla: string;
let coupleId: string;

const requestKey = () => crypto.randomUUID();

async function createCouple(userId: string) {
  const [row] = await asUser<{ id: string }>(db, userId, "select public.create_couple('Nosotros') as id");
  return row.id;
}

async function invite(userId: string) {
  const [row] = await asUser<{ token: string }>(db, userId, "select * from public.create_invitation()");
  return row.token;
}

async function createEntry(userId: string, couple: string, action: "draft" | "share", key = requestKey()) {
  const [row] = await asUser<{ id: string }>(
    db,
    userId,
    `select public.save_couple_talk_entry(
      null, $1, $2, 'upset', 'Quiero explicar cómo viví lo sucedido.',
      array['sadness', 'confusion']::text[], array['listen', 'understand']::text[],
      'talk_now', 'Me gustaría que pudiéramos escucharnos.'
    ) as id`,
    [key, action],
  );
  expect(couple).toBeTruthy();
  return { id: row.id, key };
}

beforeEach(async () => {
  db = await createTestDb();
  ana = await createUser(db, "ana@example.com");
  bruno = await createUser(db, "bruno@example.com");
  carla = await createUser(db, "carla@example.com");
  coupleId = await createCouple(ana);
  await asUser(db, bruno, "select public.accept_invitation($1)", [await invite(ana)]);
});

describe("Hablemos y privacidad de pareja", () => {
  it("mantiene borradores privados y comparte solo al convertirlos explícitamente", async () => {
    const draft = await createEntry(ana, coupleId, "draft");
    expect(await asUser(db, ana, "select id, status from public.couple_talk_threads where id = $1", [draft.id]))
      .toEqual([{ id: draft.id, status: "draft" }]);
    expect(await asUser(db, bruno, "select id from public.couple_talk_threads where id = $1", [draft.id])).toEqual([]);
    expect(await asUser(db, carla, "select id from public.couple_talk_threads where id = $1", [draft.id])).toEqual([]);

    await asUser(db, ana,
      `select public.save_couple_talk_entry(
        $1, $2, 'share', 'upset', 'Quiero explicar cómo viví lo sucedido.',
        array['sadness', 'confusion']::text[], array['listen', 'understand']::text[],
        'talk_now', 'Me gustaría que pudiéramos escucharnos.'
      )`,
      [draft.id, draft.key],
    );
    expect(await asUser(db, bruno, "select status, visibility from public.couple_talk_threads where id = $1", [draft.id]))
      .toEqual([{ status: "pending_read", visibility: "shared" }]);
    expect(await asUser(db, carla, "select id from public.couple_talk_threads")).toEqual([]);
    expect(await asUser(db, bruno, "select event_type from public.couple_talk_notifications"))
      .toEqual([{ event_type: "entry_shared" }]);
    expect(await asUser(db, ana, "select id from public.couple_talk_notifications")).toEqual([]);
  });

  it("limita todas las escrituras a RPCs validadas e impide compartir sin pareja vinculada", async () => {
    const draft = await createEntry(ana, coupleId, "draft");
    expect(await expectError(db, ana,
      `insert into public.couple_talk_threads
        (couple_id, request_key, category, story, emotions, needs, expectation)
       values ($1, gen_random_uuid(), 'other', 'directo', array['anger'], array['listen'], 'talk_now')`,
      [coupleId],
    )).toMatch(/permission denied/);
    expect(await expectError(db, ana, "update public.couple_talk_threads set status = 'resolved' where id = $1", [draft.id]))
      .toMatch(/permission denied/);

    const soloCouple = await createCouple(carla);
    expect(await expectError(db, carla,
      `select public.save_couple_talk_entry(
        null, gen_random_uuid(), 'share', 'other', 'Quiero conversar.',
        array['sadness'], array['listen'], 'talk_now', null
      )`,
    )).toMatch(/partner_not_linked/);
    expect(soloCouple).not.toBe(coupleId);
  });

  it("sincroniza respuestas, estado de lectura y solicitudes de pausa", async () => {
    const thread = await createEntry(ana, coupleId, "share");
    await asUser(db, bruno, "select public.mark_couple_talk_read($1)", [thread.id]);
    expect(await asUser(db, ana, "select status, read_by from public.couple_talk_threads where id = $1", [thread.id]))
      .toEqual([{ status: "read", read_by: [bruno] }]);

    const key = requestKey();
    const [message] = await asUser<{ id: string }>(
      db,
      bruno,
      `select public.add_couple_talk_message(
        $1, $2, 'listen', 'Quiero escucharte con calma.',
        array['calm']::text[], array['listen', 'understand']::text[]
      ) as id`,
      [thread.id, key],
    );
    const [retry] = await asUser<{ id: string }>(
      db,
      bruno,
      `select public.add_couple_talk_message(
        $1, $2, 'listen', 'Quiero escucharte con calma.',
        array['calm']::text[], array['listen', 'understand']::text[]
      ) as id`,
      [thread.id, key],
    );
    expect(retry.id).toBe(message.id);
    expect(await asUser(db, ana, "select body from public.couple_talk_messages where thread_id = $1", [thread.id]))
      .toEqual([{ body: "Quiero escucharte con calma." }]);
    expect(await asUser(db, ana, "select status from public.couple_talk_threads where id = $1", [thread.id]))
      .toEqual([{ status: "conversation" }]);

    await asUser(db, ana, "select public.set_couple_talk_pause($1, true)", [thread.id]);
    expect(await asUser(db, bruno, "select event_type from public.couple_talk_notifications order by created_at"))
      .toEqual([{ event_type: "entry_shared" }, { event_type: "pause_requested" }]);
    expect(await asUser(db, ana, "select event_type from public.couple_talk_notifications"))
      .toEqual([{ event_type: "message_received" }]);
    await asUser(db, bruno, "select public.set_couple_talk_pause($1, false)", [thread.id]);
    expect(await asUser(db, ana, "select pause_requested_by from public.couple_talk_threads where id = $1", [thread.id]))
      .toEqual([{ pause_requested_by: null }]);
  });

  it("solo marca resuelto con la confirmación de ambos y exige doble aceptación del acuerdo", async () => {
    const thread = await createEntry(ana, coupleId, "share");
    await asUser(db, ana, "select public.set_couple_talk_resolution($1, true)", [thread.id]);
    expect(await asUser(db, ana, "select status, resolution_votes from public.couple_talk_threads where id = $1", [thread.id]))
      .toEqual([{ status: "in_progress", resolution_votes: [ana] }]);
    expect(await expectError(db, ana,
      "select public.propose_couple_talk_agreement($1, gen_random_uuid(), 'Escucharnos sin interrumpirnos.')",
      [thread.id],
    )).toMatch(/couple_talk_not_mutually_resolved/);

    await asUser(db, bruno, "select public.set_couple_talk_resolution($1, true)", [thread.id]);
    expect(await asUser(db, bruno, "select status from public.couple_talk_threads where id = $1", [thread.id]))
      .toEqual([{ status: "resolved" }]);
    const [agreement] = await asUser<{ id: string }>(
      db,
      ana,
      "select public.propose_couple_talk_agreement($1, gen_random_uuid(), 'Escucharnos sin interrumpirnos.') as id",
      [thread.id],
    );
    expect(await asUser(db, ana, "select status, accepted_by from public.couple_talk_agreements where id = $1", [agreement.id]))
      .toEqual([{ status: "pending", accepted_by: [ana] }]);
    expect(await expectError(db, ana,
      "select public.respond_to_couple_talk_agreement($1, true)",
      [agreement.id],
    )).toMatch(/couple_talk_agreement_not_found/);
    await asUser(db, bruno, "select public.respond_to_couple_talk_agreement($1, true)", [agreement.id]);
    expect(await asUser(db, ana, "select status, accepted_by from public.couple_talk_agreements where id = $1", [agreement.id]))
      .toEqual([{ status: "accepted", accepted_by: [ana, bruno] }]);
  });
});
