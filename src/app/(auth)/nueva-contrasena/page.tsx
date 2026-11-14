"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { PasswordForm } from "@/components/forms/password-form";
import { getUser } from "@/lib/dal";

export default function NewPasswordPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    getUser().then((user) => {
      if (user) setAuthorized(true);
      else router.replace("/login?next=%2Fnueva-contrasena");
    }).catch(() => router.replace("/login?next=%2Fnueva-contrasena"));
  }, [router]);

  if (!authorized) return <Alert tone="info">Verificando el enlace…</Alert>;
  return (
    <Card>
      <h1 className="font-display text-3xl font-semibold text-wine-700">Crea una contraseña nueva</h1>
      <p className="mt-1 mb-6 text-sm text-ink-500">Después entrarás directamente a vuestro espacio.</p>
      <PasswordForm redirectAfter />
    </Card>
  );
}
