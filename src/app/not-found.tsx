import { Compass } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <EmptyState
        icon={Compass}
        title="Esta página no existe"
        description="Puede que el enlace esté incompleto o que ya no esté disponible."
        action={<ButtonLink href="/">Volver al inicio</ButtonLink>}
      />
    </main>
  );
}
