import type { Metadata } from "next";
import Link from "next/link";
import { HeartHandshake, MailOpen, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CoupleHeader } from "@/components/couple/couple-header";
import { getCoupleContext, getMyProfile } from "@/lib/dal";
import { daysBetween, formatLongDate, nextAnniversary, todayIn } from "@/lib/dates";

export const metadata: Metadata = { title: "Inicio" };

export default async function HomePage({ searchParams }: PageProps<"/inicio">) {
  const [{ bienvenida }, profile, context] = await Promise.all([searchParams, getMyProfile(), getCoupleContext()]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-4xl font-semibold text-wine-700">Hola, {profile.display_name}</h1>

      {bienvenida === "1" && context?.partner && (
        <Alert tone="success">¡Ya estáis vinculados! Este es vuestro espacio compartido.</Alert>
      )}

      {!context && (
        <Card>
          <EmptyState
            icon={HeartHandshake}
            title="Creemos vuestro espacio"
            description="Crea el espacio de la pareja e invita a la otra persona, o abre el enlace de invitación que te hayan enviado."
            action={<ButtonLink href="/pareja">Crear nuestro espacio</ButtonLink>}
          />
          <p className="flex items-center justify-center gap-2 text-center text-xs text-ink-500">
            <MailOpen className="size-4" aria-hidden />
            ¿Tienes una invitación? Ábrela desde el enlace que te compartieron.
          </p>
        </Card>
      )}

      {context && !context.partner && (
        <Card>
          <EmptyState
            icon={Sparkles}
            title="Falta tu pareja"
            description="Genera un enlace de invitación y compártelo. Cuando lo acepte, compartiréis este espacio."
            action={<ButtonLink href="/pareja">Invitar a mi pareja</ButtonLink>}
          />
        </Card>
      )}

      {context?.partner && (
        <Card>
          <CoupleHeader me={profile} partner={context.partner} coupleName={context.couple.name} />
          {context.couple.anniversary_date ? (
            <AnniversaryStats date={context.couple.anniversary_date} timeZone={context.couple.timezone} />
          ) : (
            <p className="mt-6 text-center text-sm text-ink-500">
              Añadid vuestra fecha de aniversario en <Link href="/pareja" className="text-wine-600 underline">Pareja</Link>{" "}
              para ver cuánto tiempo lleváis juntos.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}

function AnniversaryStats({ date, timeZone }: { date: string; timeZone: string }) {
  const today = todayIn(timeZone);
  const days = daysBetween(date, today);
  if (days < 0) return null;
  const next = nextAnniversary(date, today);

  return (
    <dl className="mt-6 grid grid-cols-2 gap-3 text-center">
      <div className="rounded-2xl bg-blush-100 px-3 py-4">
        <dt className="text-xs text-ink-500">Juntos desde el {formatLongDate(date)}</dt>
        <dd className="mt-1 font-display text-3xl font-semibold text-wine-700">
          {days.toLocaleString("es")} {days === 1 ? "día" : "días"}
        </dd>
      </div>
      <div className="rounded-2xl bg-blush-100 px-3 py-4">
        <dt className="text-xs text-ink-500">
          {next.daysUntil === 0 ? "¡Hoy es vuestro aniversario!" : `Próximo aniversario (${next.years}º)`}
        </dt>
        <dd className="mt-1 font-display text-3xl font-semibold text-wine-700">
          {next.daysUntil === 0 ? "♡" : `${next.daysUntil} ${next.daysUntil === 1 ? "día" : "días"}`}
        </dd>
      </div>
    </dl>
  );
}
