import type { Metadata } from "next";
import { Card, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { CoupleForm } from "@/components/couple/couple-form";
import { InvitationPanel } from "@/components/couple/invitation-panel";
import { LeaveCoupleForm } from "@/components/couple/leave-couple-form";
import { CoupleHeader } from "@/components/couple/couple-header";
import { createCouple, updateCouple } from "@/features/couple/actions";
import { getCoupleContext, getMyProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { listTimeZones } from "@/lib/timezones";
import { todayIn } from "@/lib/dates";

export const metadata: Metadata = { title: "Pareja" };

export default async function CouplePage() {
  const [profile, context] = await Promise.all([getMyProfile(), getCoupleContext()]);

  if (!context) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <h1 className="font-display text-4xl font-semibold text-wine-700">Vuestro espacio</h1>
        <Card>
          <CardHeader
            title="Crear el espacio de la pareja"
            description="Después podrás invitar a tu pareja con un enlace privado. Si ya te invitaron, abre ese enlace en lugar de crear uno nuevo."
          />
          <CoupleForm
            action={createCouple}
            zones={listTimeZones(profile.timezone)}
            defaults={{ name: "", anniversaryDate: "", timezone: profile.timezone }}
            submitLabel="Crear nuestro espacio"
            maxDate={todayIn(profile.timezone)}
          />
        </Card>
      </div>
    );
  }

  const { couple, partner } = context;
  let activeInvitation: { id: string; expires_at: string } | null = null;

  if (!partner) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("couple_invitations")
      .select("id, expires_at")
      .eq("couple_id", couple.id)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    activeInvitation = data;
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <h1 className="font-display text-4xl font-semibold text-wine-700">Vuestro espacio</h1>

      {partner ? (
        <Card>
          <CoupleHeader me={profile} partner={partner} coupleName={couple.name} />
        </Card>
      ) : (
        <Card>
          <CardHeader title="Invita a tu pareja" description="El enlace es personal, caduca a los 7 días y solo se puede usar una vez." />
          <div className="mb-5 flex items-center gap-3">
            <Avatar name={profile.display_name} url={profile.avatarUrl} />
            <p className="text-sm text-ink-500">De momento solo estás tú en este espacio.</p>
          </div>
          <InvitationPanel
            activeInvitation={activeInvitation ? { id: activeInvitation.id, expiresAt: activeInvitation.expires_at } : null}
            timeZone={profile.timezone}
          />
        </Card>
      )}

      <Card>
        <CardHeader title="Datos de la pareja" description="Los ven y pueden editarlos ambas personas." />
        <CoupleForm
          action={updateCouple}
          zones={listTimeZones(couple.timezone)}
          defaults={{
            name: couple.name ?? "",
            anniversaryDate: couple.anniversary_date ?? "",
            timezone: couple.timezone,
          }}
          submitLabel="Guardar cambios"
          maxDate={todayIn(profile.timezone)}
        />
      </Card>

      <Card className="border-danger-700/20">
        <CardHeader
          title="Salir de la pareja"
          description={
            partner
              ? `Perderás el acceso al espacio compartido. ${partner.display_name} conservará los datos.`
              : "Como eres la única persona, el espacio se eliminará."
          }
        />
        <LeaveCoupleForm />
      </Card>
    </div>
  );
}
