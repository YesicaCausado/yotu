import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginContent } from "./login-content";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default function LoginPage() {
  return <Suspense fallback={<p className="text-sm text-ink-500">Cargando…</p>}><LoginContent /></Suspense>;
}
