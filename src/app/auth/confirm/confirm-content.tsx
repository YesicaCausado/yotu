"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/routes";

const OTP_TYPES: EmailOtpType[] = ["signup", "email", "recovery", "invite", "magiclink", "email_change"];

export function ConfirmContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [message, setMessage] = useState("Verificando el enlace…");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const finish = async () => {
      const tokenHash = params.get("token_hash");
      const type = params.get("type") as EmailOtpType | null;
      const code = params.get("code");
      const supabase = createClient();
      let ok = false;
      if (tokenHash && type && OTP_TYPES.includes(type)) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        ok = !error;
      } else if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        ok = !error;
      }

      if (!active) return;
      if (!ok) {
        setFailed(true);
        setMessage("No pudimos completar el enlace. Puede haber caducado o ya haberse utilizado.");
        return;
      }
      router.replace(safeNextPath(params.get("next") ?? (type === "recovery" ? "/nueva-contrasena" : "/inicio")));
    };
    finish().catch(() => {
      if (active) {
        setFailed(true);
        setMessage("No se pudo verificar el enlace. Comprueba tu conexión e inténtalo de nuevo.");
      }
    });
    return () => { active = false; };
  }, [params, router]);

  return (
    <div className="mx-auto max-w-md">
      <Alert tone={failed ? "error" : "info"}>{message}</Alert>
      {failed && <div className="mt-4 text-center"><ButtonLink href="/login">Ir a iniciar sesión</ButtonLink></div>}
    </div>
  );
}
