import { Suspense } from "react";
import { InvitationContent } from "./invitation-content";

export default function InvitationPage() {
  return <Suspense fallback={<p className="text-sm text-ink-500">Cargando invitación…</p>}><InvitationContent /></Suspense>;
}
