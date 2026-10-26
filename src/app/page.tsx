import { redirect } from "next/navigation";
import { CalendarHeart, Gift, LockKeyhole } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { ButtonLink } from "@/components/ui/button";
import { getUser } from "@/lib/dal";

const features = [
  { Icon: CalendarHeart, title: "Vuestras citas", text: "Organizad planes y tened un calendario compartido." },
  { Icon: Gift, title: "Sorpresas de verdad", text: "Detalles ocultos que solo se revelan cuando llega el momento." },
  { Icon: LockKeyhole, title: "Solo para dos", text: "Un espacio privado al que nadie más puede acceder." },
];

export default async function Home() {
  if (await getUser()) redirect("/inicio");

  return (
    <div className="flex flex-1 flex-col bg-[radial-gradient(ellipse_at_top,var(--color-blush-100),transparent_65%)]">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5">
        <Logo />
        <ButtonLink href="/login" variant="ghost">
          Entrar
        </ButtonLink>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-4 pt-12 pb-16 text-center sm:pt-20">
        <h1 className="max-w-2xl font-display text-5xl leading-tight font-semibold text-wine-700 sm:text-6xl animate-fade-in">
          Un lugar solo vuestro
        </h1>
        <p className="mt-5 max-w-lg text-base text-ink-500 sm:text-lg">
          Citas, sorpresas, gustos y recuerdos de vuestra relación, guardados en un espacio íntimo y seguro.
        </p>
        <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <ButtonLink href="/registro">Crear cuenta</ButtonLink>
          <ButtonLink href="/login" variant="secondary">
            Ya tengo cuenta
          </ButtonLink>
        </div>

        <ul className="mt-16 grid w-full gap-4 text-left sm:grid-cols-3">
          {features.map(({ Icon, title, text }) => (
            <li key={title} className="rounded-3xl border border-line bg-cream-50/80 p-5 shadow-soft">
              <Icon className="size-6 text-rose-500" aria-hidden />
              <h2 className="mt-3 font-display text-xl font-semibold text-wine-700">{title}</h2>
              <p className="mt-1 text-sm text-ink-500">{text}</p>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
