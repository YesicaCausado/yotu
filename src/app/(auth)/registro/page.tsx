import type { Metadata } from "next";
import { Suspense } from "react";
import { RegisterContent } from "./register-content";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function RegisterPage() {
  return <Suspense fallback={<p className="text-sm text-ink-500">Cargando…</p>}><RegisterContent /></Suspense>;
}
