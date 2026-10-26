import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/dal";
import { PasswordForm } from "@/components/forms/password-form";

export const metadata: Metadata = { title: "Nueva contraseña" };

export default async function NewPasswordPage() {
  await requireUser("/nueva-contrasena");

  return (
    <Card>
      <h1 className="font-display text-3xl font-semibold text-wine-700">Crea una contraseña nueva</h1>
      <p className="mt-1 mb-6 text-sm text-ink-500">Después entrarás directamente a vuestro espacio.</p>
      <PasswordForm redirectAfter />
    </Card>
  );
}
