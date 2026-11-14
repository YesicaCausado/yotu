import { Suspense } from "react";
import { ConfirmContent } from "./confirm-content";

export default function ConfirmPage() {
  return <Suspense fallback={<p className="text-sm text-ink-500">Verificando el enlace…</p>}><ConfirmContent /></Suspense>;
}
