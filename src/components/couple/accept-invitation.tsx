"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptInvitation } from "@/features/couple/actions";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/alert";
import type { FormState } from "@/lib/form";

export function AcceptInvitation({ token }: { token: string }) {
  const router = useRouter();
  const [state, setState] = useState<FormState | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (state?.redirectTo) router.replace(state.redirectTo);
  }, [router, state?.redirectTo]);

  return (
    <div className="flex flex-col gap-4">
      {state && <FormMessage state={state} />}
      <Button
        type="button"
        className="w-full"
        pending={pending}
        onClick={() => startTransition(async () => {
          try {
            setState(await acceptInvitation(token));
          } catch {
            setState({ status: "error", message: "No se pudo aceptar la invitación. Inténtalo de nuevo." });
          }
        })}
      >
        Aceptar invitación
      </Button>
    </div>
  );
}
