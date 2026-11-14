import type { Metadata } from "next";
import { CalendarHeart } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { AppointmentsWorkspace } from "@/features/appointments/appointments-workspace";
import { getCoupleAppointments, getCoupleContext } from "@/lib/dal";

export const metadata: Metadata = { title: "Nuestras citas" };

export default async function AppointmentsPage() {
  const context = await getCoupleContext();
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

  const appointments = await getCoupleAppointments(context.couple.id);
  return (
    <AppointmentsWorkspace
      appointments={appointments}
      coupleId={context.couple.id}
      timeZone={context.couple.timezone}
    />
  );
}
