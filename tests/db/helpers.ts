import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..", "..");

/** Crea una base PGlite nueva con el entorno simulado de Supabase y todas las migraciones. */
export async function createTestDb() {
  const db = new PGlite();
  await db.exec(readFileSync(join(__dirname, "supabase-stub.sql"), "utf8"));

  const dir = join(root, "supabase", "migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(dir, file), "utf8"));
  }
  return db;
}

/** Crea un usuario en auth.users (como hace Supabase Auth) y devuelve su id. */
export async function createUser(
  db: PGlite,
  email: string,
  meta: Record<string, unknown> = {},
) {
  const { rows } = await db.query<{ id: string }>(
    "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
    [email, JSON.stringify(meta)],
  );
  return rows[0].id;
}

/**
 * Ejecuta una consulta como un usuario autenticado concreto (o como anon si
 * userId es null), con RLS aplicada igual que en PostgREST.
 */
export async function asUser<T = Record<string, unknown>>(
  db: PGlite,
  userId: string | null,
  sql: string,
  params: unknown[] = [],
) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${userId ? "authenticated" : "anon"}`);
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? ""]);
    const result = await tx.query<T>(sql, params);
    return result.rows;
  });
}

/** Igual que asUser, pero devuelve el mensaje de error esperado. */
export async function expectError(
  db: PGlite,
  userId: string | null,
  sql: string,
  params: unknown[] = [],
): Promise<string> {
  try {
    await asUser(db, userId, sql, params);
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error(`Se esperaba un error al ejecutar: ${sql}`);
}
