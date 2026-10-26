import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import type { Database } from "@/types/database";

/** Cliente para Client Components. Solo usa la clave pública; la RLS protege los datos. */
export function createClient() {
  return createBrowserClient<Database>(env.supabaseUrl(), env.supabaseAnonKey());
}
