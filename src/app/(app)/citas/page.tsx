"use client";

import { useEffect, useState } from "react";
import { CalendarHeart } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { AppointmentsWorkspace } from "@/features/appointments/appointments-workspace";
import { getCoupleAppointments, getCoupleContext, type CoupleContext, type AppointmentWithCover } from "@/lib/dal";
import { Alert } from "@/components/ui/alert";

export default function AppointmentsPage() {
  const [context, setContext] = useState<CoupleContext | null>(null);
  const [appointments, setAppointments] = useState<AppointmentWithCover[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    getCoupleContext()
      .then(async (value) => {
        if (!active) return;
        setContext(value);
        if (value) {
          const items = await getCoupleAppointments(value.couple.id);
          if (active) setAppointments(items);
        }
      })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <p className="text-sm text-ink-500">Cargando sus citas…</p>;
  if (error) return <Alert tone="error">No se pudieron cargar las citas. Inténtalo de nuevo.</Alert>;

  if (!context) {
    return (
      <Card>
        <EmptyState
          icon={CalendarHeart}
          title="Vuestros planes empiezan aquí"
          description="Crea vuestro espacio de pareja para empezar a planear momentos juntos."
          action={<ButtonLink href="/pareja">Ir a Pareja</ButtonLink>}
        />
      </Card>
    );
  }

  return (
    <AppointmentsWorkspace
      appointments={appointments}
      coupleId={context.couple.id}
      timeZone={context.couple.timezone}
    />
  );
}
