"use client";

import { CloudOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function AppError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <Card>
      <EmptyState
        icon={CloudOff}
        title="No pudimos cargar esta sección"
        description="Puede ser un problema de conexión. Tus datos están a salvo."
        action={<Button onClick={() => retry()}>Reintentar</Button>}
      />
    </Card>
  );
}
