"use client";

import { useEffect, useState } from "react";
import { CalendarRange } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { CalendarWorkspace } from "@/features/calendar/calendar-workspace";
import { getCoupleContext, getUser, type CoupleContext } from "@/lib/dal";

export default function CalendarPage() {
  const [context, setContext] = useState<CoupleContext | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([getCoupleContext(), getUser()])
      .then(([coupleContext, user]) => {
        if (!active) return;
        setContext(coupleContext);
        setUserId(user?.id ?? null);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <p className="text-sm text-ink-500">Cargando sus calendarios…</p>;
  if (error || !userId) return <Alert tone="error">No se pudo cargar el calendario. Comprueba tu conexión e inténtalo de nuevo.</Alert>;

  if (!context) {
    return (
      <Card>
        <EmptyState
          icon={CalendarRange}
          title="Tu calendario empieza aquí"
          description="Crea vuestro espacio de pareja para organizar actividades individuales y encontrar tiempo juntos."
          action={<ButtonLink href="/pareja">Ir a Pareja</ButtonLink>}
        />
      </Card>
    );
  }

  return (
    <CalendarWorkspace
      coupleId={context.couple.id}
      timeZone={context.couple.timezone}
      userId={userId}
      partner={context.partner ? { id: context.partner.id, name: context.partner.display_name } : null}
    />
  );
}
