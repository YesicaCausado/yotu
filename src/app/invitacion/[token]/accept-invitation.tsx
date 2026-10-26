"use client";

import { useState, useTransition } from "react";
import { acceptInvitation } from "@/features/couple/actions";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/alert";
import type { FormState } from "@/lib/form";

export function AcceptInvitation({ token }: { token: string }) {
  const [state, setState] = useState<FormState | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-4">
      {state && <FormMessage state={state} />}
      <Button
        type="button"
        className="w-full"
        pending={pending}
        onClick={() => startTransition(async () => setState(await acceptInvitation(token)))}
      >
        Aceptar invitación
      </Button>
    </div>
  );
}
