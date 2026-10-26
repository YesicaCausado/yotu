import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { asUser, createTestDb, createUser, expectError } from "./helpers";

let db: PGlite;
let ana: string;
let bruno: string;
let carla: string;

async function createCouple(userId: string) {
  const [row] = await asUser<{ id: string }>(db, userId, "select public.create_couple('Nosotros') as id");
  return row.id;
}

async function invite(userId: string) {
  const [row] = await asUser<{ token: string; expires_at: Date }>(
    db,
    userId,
    "select * from public.create_invitation()",
  );
  return row.token;
}

async function accept(userId: string, token: string) {
  return asUser(db, userId, "select public.accept_invitation($1)", [token]);
}

beforeEach(async () => {
  db = await createTestDb();
  ana = await createUser(db, "ana@example.com", { display_name: "Ana", timezone: "America/Bogota" });
  bruno = await createUser(db, "bruno@example.com", { display_name: "Bruno" });
  carla = await createUser(db, "carla@example.com", { display_name: "Carla", timezone: "No/Existe" });
});

describe("perfiles", () => {
  it("se crean automáticamente al registrarse, con zona horaria válida", async () => {
    const { rows } = await db.query<{ display_name: string; timezone: string }>(
      "select display_name, timezone from public.profiles order by display_name",
    );
    expect(rows).toEqual([
      { display_name: "Ana", timezone: "America/Bogota" },
      { display_name: "Bruno", timezone: "UTC" },
      { display_name: "Carla", timezone: "UTC" },
    ]);
  });

  it("cada usuario solo ve su propio perfil si no tiene pareja", async () => {
    const rows = await asUser<{ id: string }>(db, ana, "select id from public.profiles");
    expect(rows.map((r) => r.id)).toEqual([ana]);
  });

  it("no permite editar el perfil de otra persona ni columnas protegidas", async () => {
    await asUser(db, ana, "update public.profiles set display_name = 'Hack' where id = $1", [bruno]);
    const { rows } = await db.query<{ display_name: string }>(
      "select display_name from public.profiles where id = $1",
      [bruno],
    );
    expect(rows[0].display_name).toBe("Bruno");

    expect(await expectError(db, ana, "update public.profiles set id = gen_random_uuid() where id = $1", [ana]))
      .toMatch(/permission denied/);
  });

  it("valida longitud del nombre y zona horaria", async () => {
    expect(await expectError(db, ana, "update public.profiles set display_name = '  ' where id = $1", [ana]))
      .toMatch(/check constraint/);
    expect(await expectError(db, ana, "update public.profiles set timezone = 'Marte/Base' where id = $1", [ana]))
      .toMatch(/check constraint/);
  });

  it("anon no tiene acceso a ninguna tabla", async () => {
    expect(await expectError(db, null, "select * from public.profiles")).toMatch(/permission denied/);
    expect(await expectError(db, null, "select * from public.couples")).toMatch(/permission denied/);
    expect(await expectError(db, null, "select public.create_couple()")).toMatch(/permission denied/);
  });
});

describe("parejas e invitaciones", () => {
  it("crea una pareja y no permite crear una segunda", async () => {
    const coupleId = await createCouple(ana);
    const members = await asUser<{ user_id: string }>(db, ana, "select user_id from public.couple_members");
    expect(members).toEqual([{ user_id: ana }]);
    expect(await expectError(db, ana, "select public.create_couple()")).toMatch(/already_in_couple/);
    expect(coupleId).toBeTruthy();
  });

  it("no permite insertar miembros ni parejas directamente", async () => {
    const coupleId = await createCouple(ana);
    expect(
      await expectError(db, bruno, "insert into public.couple_members (couple_id, user_id) values ($1, $2)", [coupleId, bruno]),
    ).toMatch(/permission denied/);
    expect(await expectError(db, bruno, "insert into public.couples (name) values ('x')")).toMatch(/permission denied/);
  });

  it("guarda solo el hash del token y oculta la columna", async () => {
    await createCouple(ana);
    const token = await invite(ana);
    expect(token).toMatch(/^[0-9a-f]{64}$/);

    const { rows } = await db.query<{ token_hash: string }>("select token_hash from public.couple_invitations");
    expect(rows[0].token_hash).not.toBe(token);
    expect(rows[0].token_hash).toHaveLength(64);

    expect(await expectError(db, ana, "select token_hash from public.couple_invitations")).toMatch(/permission denied/);
    const visible = await asUser(db, ana, "select id, expires_at from public.couple_invitations");
    expect(visible).toHaveLength(1);
  });

  it("vincula a la pareja con una invitación válida", async () => {
    const coupleId = await createCouple(ana);
    const token = await invite(ana);

    const [preview] = await asUser<{ status: string; inviter_name: string }>(
      db,
      bruno,
      "select * from public.get_invitation_preview($1)",
      [token],
    );
    expect(preview).toMatchObject({ status: "valid", inviter_name: "Ana" });

    await accept(bruno, token);

    const members = await asUser<{ user_id: string }>(db, bruno, "select user_id from public.couple_members order by joined_at");
    expect(members.map((m) => m.user_id).sort()).toEqual([ana, bruno].sort());

    const profiles = await asUser<{ id: string }>(db, bruno, "select id from public.profiles");
    expect(profiles.map((p) => p.id).sort()).toEqual([ana, bruno].sort());

    const [couple] = await asUser<{ id: string }>(db, bruno, "select id from public.couples");
    expect(couple.id).toBe(coupleId);
  });

  it("rechaza tokens reutilizados, propios, revocados, caducados e inválidos", async () => {
    await createCouple(ana);

    const own = await invite(ana);
    expect(await expectError(db, ana, "select public.accept_invitation($1)", [own])).toMatch(/own_invitation/);

    // Generar una nueva revoca la anterior.
    const second = await invite(ana);
    expect(await expectError(db, bruno, "select public.accept_invitation($1)", [own])).toMatch(/invitation_revoked/);

    await db.query("update public.couple_invitations set expires_at = now() - interval '1 minute' where revoked_at is null");
    expect(await expectError(db, bruno, "select public.accept_invitation($1)", [second])).toMatch(/invitation_expired/);

    expect(await expectError(db, bruno, "select public.accept_invitation($1)", ["nope"])).toMatch(/invalid_invitation/);

    const third = await invite(ana);
    await accept(bruno, third);
    expect(await expectError(db, carla, "select public.accept_invitation($1)", [third])).toMatch(/invitation_used/);
  });

  it("revoca una invitación solo si es miembro de la pareja", async () => {
    await createCouple(ana);
    const token = await invite(ana);
    const [{ id }] = await asUser<{ id: string }>(db, ana, "select id from public.couple_invitations");

    expect(await expectError(db, carla, "select public.revoke_invitation($1)", [id])).toMatch(/invalid_invitation/);
    await asUser(db, ana, "select public.revoke_invitation($1)", [id]);
    expect(await expectError(db, bruno, "select public.accept_invitation($1)", [token])).toMatch(/invitation_revoked/);
  });

  it("una pareja tiene como máximo dos personas", async () => {
    const coupleId = await createCouple(ana);
    await accept(bruno, await invite(ana));
    expect(await expectError(db, ana, "select * from public.create_invitation()")).toMatch(/couple_full/);

    // Ni siquiera como superusuario se puede saltar el límite.
    await expect(
      db.query("insert into public.couple_members (couple_id, user_id) values ($1, $2)", [coupleId, carla]),
    ).rejects.toThrow(/couple_full/);
  });

  it("quien ya tiene pareja no puede unirse a otra", async () => {
    await createCouple(ana);
    await createCouple(carla);
    const token = await invite(ana);
    expect(await expectError(db, carla, "select public.accept_invitation($1)", [token])).toMatch(/already_in_couple/);
  });

  it("aísla completamente a las personas ajenas a la pareja", async () => {
    const coupleId = await createCouple(ana);
    await accept(bruno, await invite(ana));

    expect(await asUser(db, carla, "select * from public.couples")).toEqual([]);
    expect(await asUser(db, carla, "select * from public.couple_members")).toEqual([]);
    expect(await asUser(db, carla, "select id from public.couple_invitations")).toEqual([]);
    expect((await asUser<{ id: string }>(db, carla, "select id from public.profiles")).map((p) => p.id)).toEqual([carla]);

    await asUser(db, carla, "update public.couples set name = 'Hack' where id = $1", [coupleId]);
    const { rows } = await db.query<{ name: string }>("select name from public.couples");
    expect(rows[0].name).toBe("Nosotros");
  });

  it("los miembros pueden editar los datos básicos de la pareja, no su autoría", async () => {
    const coupleId = await createCouple(ana);
    await accept(bruno, await invite(ana));
    await asUser(db, bruno, "update public.couples set name = 'Ana & Bruno', anniversary_date = '2024-02-14' where id = $1", [coupleId]);
    const { rows } = await db.query<{ name: string }>("select name from public.couples");
    expect(rows[0].name).toBe("Ana & Bruno");

    expect(await expectError(db, bruno, "update public.couples set created_by = $1 where id = $2", [bruno, coupleId]))
      .toMatch(/permission denied/);
  });

  it("salir de la pareja retira el acceso y elimina la pareja vacía", async () => {
    await createCouple(ana);
    await accept(bruno, await invite(ana));

    await asUser(db, bruno, "select public.leave_couple()");
    expect(await asUser(db, bruno, "select * from public.couples")).toEqual([]);
    expect((await asUser<{ id: string }>(db, bruno, "select id from public.profiles")).map((p) => p.id)).toEqual([bruno]);
    expect(await asUser(db, ana, "select id from public.couples")).toHaveLength(1);

    await asUser(db, ana, "select public.leave_couple()");
    const { rows } = await db.query("select * from public.couples");
    expect(rows).toEqual([]);

    expect(await expectError(db, ana, "select public.leave_couple()")).toMatch(/not_in_couple/);
  });
});

describe("avatares en Storage", () => {
  const upload = (userId: string, path: string) =>
    asUser(db, userId, "insert into storage.objects (bucket_id, name) values ('avatars', $1)", [path]);
  const visible = (userId: string) =>
    asUser<{ name: string }>(db, userId, "select name from storage.objects order by name");

  it("solo se puede subir a la carpeta propia", async () => {
    await upload(ana, `${ana}/avatar.webp`);
    expect(
      await expectError(db, ana, "insert into storage.objects (bucket_id, name) values ('avatars', $1)", [`${bruno}/x.webp`]),
    ).toMatch(/row-level security/);
    expect(
      await expectError(db, ana, "insert into storage.objects (bucket_id, name) values ('avatars', 'suelto.webp')"),
    ).toMatch(/row-level security/);
  });

  it("la pareja ve el avatar; terceros no", async () => {
    await upload(ana, `${ana}/avatar.webp`);
    await upload(carla, `${carla}/avatar.webp`);
    expect(await visible(bruno)).toEqual([]);

    await createCouple(ana);
    await accept(bruno, await invite(ana));

    expect((await visible(bruno)).map((o) => o.name)).toEqual([`${ana}/avatar.webp`]);
    expect((await visible(carla)).map((o) => o.name)).toEqual([`${carla}/avatar.webp`]);
  });

  it("nadie puede borrar el avatar de otra persona", async () => {
    await upload(ana, `${ana}/avatar.webp`);
    await createCouple(ana);
    await accept(bruno, await invite(ana));
    await asUser(db, bruno, "delete from storage.objects");
    expect(await visible(ana)).toHaveLength(1);
  });
});
