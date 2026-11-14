"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { HeartHandshake, LinkIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { AcceptInvitation } from "@/components/couple/accept-invitation";
import { getMyProfile, getUser, type ProfileWithAvatar } from "@/lib/dal";
import { createClient } from "@/lib/supabase/client";
import { invitationTokenSchema } from "@/lib/validation";
import { formatDateTime } from "@/lib/dates";
import type { InvitationStatus } from "@/types/database";

const STATUS_MESSAGES: Record<Exclude<InvitationStatus, "valid">, { title: string; description: string }> = {
  invalid: { title: "Invitación no válida", description: "El enlace no existe o está incompleto. Pide a tu pareja que te lo vuelva a enviar." },
  revoked: { title: "Invitación anulada", description: "Esta invitación ya no está activa. Pide un enlace nuevo." },
  used: { title: "Invitación ya utilizada", description: "Este enlace ya se usó para unirse a una pareja." },
  expired: { title: "Invitación caducada", description: "Los enlaces caducan a los 7 días. Pide uno nuevo." },
  own: { title: "Es tu propia invitación", description: "Comparte este enlace con tu pareja para que lo abra desde su cuenta." },
  already_in_couple: { title: "Ya tienes pareja en Yotu", description: "Para aceptar esta invitación primero tendrías que salir de tu pareja actual." },
  couple_full: { title: "Pareja completa", description: "Este espacio ya tiene dos personas." },
};

type Preview = { status: InvitationStatus; inviter_name: string | null; expires_at: string | null };

export function InvitationContent() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [user, setUser] = useState(false);
  const [profile, setProfile] = useState<ProfileWithAvatar | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const currentUser = await getUser();
      if (!active) return;
      setUser(Boolean(currentUser));
      if (!invitationTokenSchema.safeParse(token).success) {
        setPreview({ status: "invalid", inviter_name: null, expires_at: null });
        setLoading(false);
        return;
      }
      if (!currentUser) {
        setLoading(false);
        return;
      }
      const supabase = createClient();
      const [{ data, error: previewError }, myProfile] = await Promise.all([
        supabase.rpc("get_invitation_preview", { p_token: token }),
        getMyProfile(),
      ]);
      if (previewError) throw previewError;
      if (!active) return;
      setPreview(data?.[0] ?? null);
      setProfile(myProfile);
      setLoading(false);
    };
    load().catch(() => { if (active) { setError(true); setLoading(false); } });
    return () => { active = false; };
  }, [token]);

  const next = `/invitacion/?token=${encodeURIComponent(token)}`;
  if (loading) return <p className="text-center text-sm text-ink-500">Cargando invitación…</p>;
  if (error) return <Card><EmptyState icon={LinkIcon} title="No pudimos comprobar la invitación" description="Comprueba tu conexión y vuelve a abrir el enlace." action={<ButtonLink href="/inicio" variant="secondary">Ir al inicio</ButtonLink>} /></Card>;
  if (!user) {
    const query = `?next=${encodeURIComponent(next)}`;
    return (
      <Card><EmptyState
        icon={HeartHandshake}
        title="Te han invitado a Yotu"
        description="Para aceptar la invitación, crea tu cuenta o inicia sesión. Volverás aquí automáticamente."
        action={<div className="flex flex-col gap-2 sm:flex-row"><ButtonLink href={`/registro${query}`}>Crear cuenta</ButtonLink><ButtonLink href={`/login${query}`} variant="secondary">Ya tengo cuenta</ButtonLink></div>}
      /></Card>
    );
  }
  if (!preview || preview.status !== "valid") {
    const status = preview?.status && preview.status !== "valid" ? preview.status : "invalid";
    return <Card><EmptyState icon={LinkIcon} {...STATUS_MESSAGES[status]} action={<ButtonLink href="/inicio" variant="secondary">Ir al inicio</ButtonLink>} /></Card>;
  }

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10 sm:py-16">
      <main className="w-full max-w-md">
        <Card>
          <div className="flex flex-col items-center text-center">
            <span className="mb-4 inline-flex size-14 items-center justify-center rounded-full bg-blush-100 text-wine-500"><HeartHandshake className="size-6" aria-hidden /></span>
            <h1 className="font-display text-3xl font-semibold text-wine-700">{preview.inviter_name ?? "Tu pareja"} te invita a su espacio</h1>
            <p className="mt-2 text-sm text-ink-500">Al aceptar compartiréis citas, sorpresas y recuerdos en un espacio privado.
              {preview.expires_at && profile && ` La invitación caduca el ${formatDateTime(preview.expires_at, profile.timezone)}.`}
            </p>
            <div className="mt-6 w-full"><AcceptInvitation token={token} /></div>
          </div>
        </Card>
      </main>
    </div>
  );
}
