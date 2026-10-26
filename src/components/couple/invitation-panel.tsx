"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Link2, Share2 } from "lucide-react";
import { createInvitation, revokeInvitation, type InvitationState } from "@/features/couple/actions";
import { Alert, FormMessage } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/form";

function formatExpiry(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("es", { dateStyle: "long", timeStyle: "short", timeZone }).format(new Date(iso));
}

export function InvitationPanel({
  activeInvitation,
  timeZone,
}: {
  activeInvitation: { id: string; expiresAt: string } | null;
  timeZone: string;
}) {
  const [created, setCreated] = useState<InvitationState | null>(null);
  const [revoked, setRevoked] = useState<FormState | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const generate = () =>
    startTransition(async () => {
      setRevoked(null);
      setCopied(false);
      setCreated(await createInvitation());
    });

  const revoke = (id: string) =>
    startTransition(async () => {
      const result = await revokeInvitation(id);
      setRevoked(result);
      if (result.status === "success") setCreated(null);
    });

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const share = async (url: string) => {
    try {
      await navigator.share({ title: "Únete a nuestro espacio en Yotu", url });
    } catch {
      // El usuario canceló o el navegador no lo soporta.
    }
  };

  const inviteUrl = created?.status === "success" ? created.inviteUrl : undefined;

  return (
    <div className="flex flex-col gap-4">
      {created?.status === "error" && <FormMessage state={created} />}
      {revoked && <FormMessage state={revoked} />}

      {inviteUrl ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-cream-100 p-4 animate-fade-in">
          <p className="text-sm font-medium text-ink-700">Enlace de invitación</p>
          <code className="break-all rounded-xl bg-cream-50 px-3 py-2 text-xs text-ink-700">{inviteUrl}</code>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => copy(inviteUrl)}>
              {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              {copied ? "Copiado" : "Copiar"}
            </Button>
            {typeof navigator !== "undefined" && "share" in navigator && (
              <Button type="button" variant="secondary" onClick={() => share(inviteUrl)}>
                <Share2 className="size-4" aria-hidden />
                Compartir
              </Button>
            )}
          </div>
          {created?.expiresAt && (
            <p className="text-xs text-ink-500">
              Caduca el {formatExpiry(created.expiresAt, timeZone)}. Por seguridad no lo volveremos a mostrar: si lo pierdes,
              genera uno nuevo.
            </p>
          )}
        </div>
      ) : (
        activeInvitation &&
        revoked?.status !== "success" && (
          <Alert tone="info">
            Hay una invitación activa que caduca el {formatExpiry(activeInvitation.expiresAt, timeZone)}. Si perdiste el
            enlace, genera uno nuevo (el anterior dejará de funcionar).
          </Alert>
        )
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={generate} pending={pending}>
          <Link2 className="size-4" aria-hidden />
          {inviteUrl || activeInvitation ? "Generar un enlace nuevo" : "Generar enlace de invitación"}
        </Button>
        {activeInvitation && !inviteUrl && revoked?.status !== "success" && (
          <Button type="button" variant="ghost" onClick={() => revoke(activeInvitation.id)} disabled={pending}>
            Anular invitación
          </Button>
        )}
      </div>
    </div>
  );
}
