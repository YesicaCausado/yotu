import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { safeNextPath } from "@/lib/routes";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Crear cuenta" };

export default async function RegisterPage({ searchParams }: PageProps<"/registro">) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const loginHref = next === "/inicio" ? "/login" : `/login?next=${encodeURIComponent(next)}`;

  return (
    <Card>
      <h1 className="font-display text-3xl font-semibold text-wine-700">Crea tu cuenta</h1>
      <p className="mt-1 mb-6 text-sm text-ink-500">
        Cada persona tiene su propia cuenta. Después podréis vincularlas con una invitación.
      </p>
      <RegisterForm next={next} />
      <p className="mt-6 text-center text-sm text-ink-500">
        ¿Ya tienes cuenta?{" "}
        <Link href={loginHref} className="font-medium text-wine-600 hover:underline">
          Inicia sesión
        </Link>
      </p>
    </Card>
  );
}
