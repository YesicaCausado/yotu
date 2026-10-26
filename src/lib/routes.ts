/** Rutas que requieren sesión (comprobación optimista en proxy.ts). */
export const PROTECTED_PREFIXES = ["/inicio", "/pareja", "/perfil", "/nueva-contrasena"];

/** Rutas solo para visitantes sin sesión. */
export const GUEST_ONLY_PREFIXES = ["/login", "/registro", "/recuperar"];

export function matchesPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Devuelve una ruta interna segura a la que redirigir, evitando redirecciones
 * abiertas (//evil.com, /\evil.com, https://...).
 */
export function safeNextPath(value: unknown, fallback = "/inicio") {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\r\n\t]/.test(value)) return fallback;
  try {
    const url = new URL(value, "http://local.invalid");
    if (url.origin !== "http://local.invalid") return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
