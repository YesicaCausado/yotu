import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { RecoverForm } from "./recover-form";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function RecoverPage() {
  return (
    <Card>
      <h1 className="font-display text-3xl font-semibold text-wine-700">Recuperar contraseña</h1>
      <p className="mt-1 mb-6 text-sm text-ink-500">Te enviaremos un enlace para crear una nueva.</p>
      <RecoverForm />
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="text-wine-600 hover:underline">
          Volver a iniciar sesión
        </Link>
      </p>
    </Card>
  );
}
