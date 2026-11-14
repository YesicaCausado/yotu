"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { ProfileForm } from "@/components/profile/profile-form";
import { PasswordForm } from "@/components/forms/password-form";
import { getMyProfile, getUser, type ProfileWithAvatar } from "@/lib/dal";
import { listTimeZones } from "@/lib/timezones";
import { todayIn } from "@/lib/dates";

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileWithAvatar | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([getUser(), getMyProfile()])
      .then(([user, myProfile]) => {
        if (!user) throw new Error("session");
        setEmail(user.email ?? "");
        setProfile(myProfile);
      })
      .catch(() => setError(true));
  }, []);

  if (error) return <Alert tone="error">No se pudo cargar el perfil. Inténtalo de nuevo.</Alert>;
  if (!profile) return <p className="text-sm text-ink-500">Cargando perfil…</p>;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <h1 className="font-display text-4xl font-semibold text-wine-700">Tu perfil</h1>
      <Card>
        <CardHeader title="Foto" description="Solo la veréis tú y tu pareja." />
        <AvatarUploader userId={profile.id} name={profile.display_name} url={profile.avatarUrl} />
      </Card>
      <Card>
        <CardHeader title="Datos personales" description={`Cuenta: ${email}`} />
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
