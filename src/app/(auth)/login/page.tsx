import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { safeNextPath } from "@/lib/routes";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const linkError = params.error === "enlace";
  const registerHref = next === "/inicio" ? "/registro" : `/registro?next=${encodeURIComponent(next)}`;

  return (
    <Card>
      <h1 className="font-display text-3xl font-semibold text-wine-700">Hola de nuevo</h1>
      <p className="mt-1 mb-6 text-sm text-ink-500">Entra a vuestro espacio.</p>
      {linkError && (
        <div className="mb-4">
          <Alert tone="error">
            No pudimos completar el enlace (puede haber caducado o haberse abierto en otro dispositivo). Si estabas
            confirmando tu cuenta, prueba a iniciar sesión; si querías cambiar la contraseña, solicita un enlace nuevo.
          </Alert>
        </div>
      )}
      <LoginForm next={next} />
      <div className="mt-6 flex flex-col gap-2 text-center text-sm text-ink-500">
        <Link href="/recuperar" className="text-wine-600 hover:underline">
          ¿Olvidaste tu contraseña?
        </Link>
        <p>
          ¿Aún no tienes cuenta?{" "}
          <Link href={registerHref} className="font-medium text-wine-600 hover:underline">
            Crear cuenta
          </Link>
        </p>
      </div>
    </Card>
  );
}
