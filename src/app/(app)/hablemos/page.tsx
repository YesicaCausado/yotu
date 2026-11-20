"use client";

import { useEffect, useState } from "react";
import { HeartHandshake } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { CoupleTalkWorkspace } from "@/features/couple-talk/couple-talk-workspace";
import { getCoupleContext, getMyProfile, getUser, type CoupleContext, type ProfileWithAvatar } from "@/lib/dal";

export default function CoupleTalkPage() {
  const [context, setContext] = useState<CoupleContext | null>(null);
  const [profile, setProfile] = useState<ProfileWithAvatar | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([getCoupleContext(), getMyProfile(), getUser()])
      .then(([coupleContext, ownProfile, user]) => {
        if (!active) return;
        setContext(coupleContext);
        setProfile(ownProfile);
        setUserId(user?.id ?? null);
      })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <p className="text-sm text-ink-500">Preparando un espacio para conversar…</p>;
  if (error) return <Alert tone="error">No se pudo cargar Hablemos. Comprueba tu conexión e inténtalo de nuevo.</Alert>;
  if (!context) {
    return (
      <Card>
        <EmptyState
          icon={HeartHandshake}
          title="Hablemos empieza en vuestro espacio"
          description="Vincula a tu pareja para compartir conversaciones privadas entre ustedes. Tus borradores siempre serán solo tuyos."
          action={<ButtonLink href="/pareja">Ir a Pareja</ButtonLink>}
        />
      </Card>
    );
  }
  if (!userId || !profile) return <Alert tone="error">Tu sesión ha caducado. Vuelve a iniciar sesión.</Alert>;

  return (
    <CoupleTalkWorkspace
      coupleId={context.couple.id}
      userId={userId}
      userName={profile.display_name}
      partnerName={context.partner?.display_name ?? "Tu pareja"}
      partnerLinked={Boolean(context.partner)}
    />
  );
}
