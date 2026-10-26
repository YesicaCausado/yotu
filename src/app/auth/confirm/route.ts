import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/routes";

const OTP_TYPES: EmailOtpType[] = ["signup", "email", "recovery", "invite", "magiclink", "email_change"];

/**
 * Destino de los enlaces de los correos de Supabase (confirmación de cuenta y
 * recuperación de contraseña). Admite las dos variantes:
 *   ?token_hash=...&type=...  (plantilla recomendada; funciona en cualquier dispositivo)
 *   ?code=...                 (flujo PKCE; requiere el mismo navegador)
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next") ?? (type === "recovery" ? "/nueva-contrasena" : "/inicio"));

  const supabase = await createClient();
  let ok = false;

  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  if (!ok) {
    return NextResponse.redirect(new URL("/login?error=enlace", origin));
  }
  return NextResponse.redirect(new URL(next, origin));
}
