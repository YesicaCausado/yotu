import type { Metadata } from "next";
import { HeartHandshake, LinkIcon } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { AcceptInvitation } from "./accept-invitation";
import { getMyProfile, getUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { invitationTokenSchema } from "@/lib/validation";
import { formatDateTime } from "@/lib/dates";
import type { InvitationStatus } from "@/types/database";

export const metadata: Metadata = { title: "Invitación" };

const STATUS_MESSAGES: Record<Exclude<InvitationStatus, "valid">, { title: string; description: string }> = {
  invalid: { title: "Invitación no válida", description: "El enlace no existe o está incompleto. Pide a tu pareja que te lo vuelva a enviar." },
  revoked: { title: "Invitación anulada", description: "Esta invitación ya no está activa. Pide un enlace nuevo." },
  used: { title: "Invitación ya utilizada", description: "Este enlace ya se usó para unirse a una pareja." },
  expired: { title: "Invitación caducada", description: "Los enlaces caducan a los 7 días. Pide uno nuevo." },
  own: { title: "Es tu propia invitación", description: "Comparte este enlace con tu pareja para que lo abra desde su cuenta." },
  already_in_couple: { title: "Ya tienes pareja en Yotu", description: "Para aceptar esta invitación primero tendrías que salir de tu pareja actual." },
  couple_full: { title: "Pareja completa", description: "Este espacio ya tiene dos personas." },
};

export default async function InvitationPage({ params }: PageProps<"/invitacion/[token]">) {
  const { token } = await params;
  const user = await getUser();
  const next = `/invitacion/${encodeURIComponent(token)}`;

  return (
    <div className="flex flex-1 flex-col items-center bg-[radial-gradient(ellipse_at_top,var(--color-blush-100),transparent_60%)] px-4 py-10 sm:py-16">
      <div className="mb-8">
        <Logo />
      </div>
      <main className="w-full max-w-md">
        <Card>{user ? <InvitationForUser token={token} /> : <InvitationForGuest next={next} />}</Card>
      </main>
    </div>
  );
}

function InvitationForGuest({ next }: { next: string }) {
  const query = `?next=${encodeURIComponent(next)}`;
  return (
    <EmptyState
      icon={HeartHandshake}
      title="Te han invitado a Yotu"
      description="Para aceptar la invitación, crea tu cuenta o inicia sesión. Volverás aquí automáticamente."
      action={
        <div className="flex flex-col gap-2 sm:flex-row">
          <ButtonLink href={`/registro${query}`}>Crear cuenta</ButtonLink>
          <ButtonLink href={`/login${query}`} variant="secondary">
            Ya tengo cuenta
          </ButtonLink>
        </div>
      }
    />
  );
}

async function InvitationForUser({ token }: { token: string }) {
  const homeLink = <ButtonLink href="/inicio" variant="secondary">Ir al inicio</ButtonLink>;

  if (!invitationTokenSchema.safeParse(token).success) {
    return <EmptyState icon={LinkIcon} {...STATUS_MESSAGES.invalid} action={homeLink} />;
  }

  const supabase = await createClient();
  const [{ data, error }, profile] = await Promise.all([
    supabase.rpc("get_invitation_preview", { p_token: token }),
    getMyProfile(),
  ]);
  const preview = data?.[0];

  if (error || !preview) {
    return (
      <EmptyState
        icon={LinkIcon}
        title="No pudimos comprobar la invitación"
        description="Revisa tu conexión y vuelve a abrir el enlace."
        action={homeLink}
      />
    );
  }

  if (preview.status !== "valid") {
    return <EmptyState icon={LinkIcon} {...STATUS_MESSAGES[preview.status]} action={homeLink} />;
  }

  return (
    <div className="flex flex-col items-center text-center">
      <span className="mb-4 inline-flex size-14 items-center justify-center rounded-full bg-blush-100 text-wine-500">
        <HeartHandshake className="size-6" aria-hidden />
      </span>
      <h1 className="font-display text-3xl font-semibold text-wine-700">
        {preview.inviter_name ?? "Tu pareja"} te invita a su espacio
      </h1>
      <p className="mt-2 text-sm text-ink-500">
        Al aceptar compartiréis citas, sorpresas y recuerdos en un espacio privado.
        {preview.expires_at && ` La invitación caduca el ${formatDateTime(preview.expires_at, profile.timezone)}.`}
      </p>
      <div className="mt-6 w-full">
        <AcceptInvitation token={token} />
      </div>
    </div>
  );
}
