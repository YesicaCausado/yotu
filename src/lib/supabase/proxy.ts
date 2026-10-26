import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { PROTECTED_PREFIXES, GUEST_ONLY_PREFIXES, matchesPrefix } from "@/lib/routes";

/**
 * Renueva la sesión de Supabase en cada petición y hace comprobaciones
 * optimistas de acceso. La autorización real está en la DAL y en la RLS.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.supabaseUrl(), env.supabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // No ejecutar código entre createServerClient y getClaims: puede provocar
  // cierres de sesión aleatorios difíciles de depurar.
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    if (path === "/login") url.searchParams.set("next", pathname + search);
    const redirect = NextResponse.redirect(url);
    // Conservar las cookies de sesión renovadas.
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (!isSignedIn && matchesPrefix(pathname, PROTECTED_PREFIXES)) {
    return redirectTo("/login");
  }
  if (isSignedIn && matchesPrefix(pathname, GUEST_ONLY_PREFIXES)) {
    return redirectTo("/inicio");
  }

  return response;
}
