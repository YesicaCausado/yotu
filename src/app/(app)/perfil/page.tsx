import type { Metadata } from "next";
import { Card, CardHeader } from "@/components/ui/card";
import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { ProfileForm } from "@/components/profile/profile-form";
import { PasswordForm } from "@/components/forms/password-form";
import { getMyProfile, requireUser } from "@/lib/dal";
import { listTimeZones } from "@/lib/timezones";
import { todayIn } from "@/lib/dates";

export const metadata: Metadata = { title: "Perfil" };

export default async function ProfilePage() {
  const [user, profile] = await Promise.all([requireUser(), getMyProfile()]);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <h1 className="font-display text-4xl font-semibold text-wine-700">Tu perfil</h1>

      <Card>
        <CardHeader title="Foto" description="Solo la veréis tú y tu pareja." />
        <AvatarUploader userId={user.id} name={profile.display_name} url={profile.avatarUrl} />
      </Card>

      <Card>
        <CardHeader title="Datos personales" description={`Cuenta: ${user.email ?? ""}`} />
        <ProfileForm
          zones={listTimeZones(profile.timezone)}
          maxDate={todayIn(profile.timezone)}
          defaults={{
            displayName: profile.display_name,
            birthday: profile.birthday ?? "",
            timezone: profile.timezone,
          }}
        />
      </Card>

      <Card>
        <CardHeader title="Cambiar contraseña" />
        <PasswordForm />
      </Card>
    </div>
  );
}
