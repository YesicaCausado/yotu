"use client";

import { useEffect, useState } from "react";
import { Clock3, Sparkles } from "lucide-react";

export function AppointmentCountdown({
  target,
  label = "Cuenta regresiva",
  compact = false,
}: {
  target: string;
  label?: string;
  compact?: boolean;
}) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setNow(Date.now());
    const initial = window.setTimeout(update, 0);
    const timer = window.setInterval(update, 1000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, []);

  if (now === null) return <p className={`text-wine-700 ${compact ? "text-xs" : "text-sm"}`}>{label}…</p>;

  const remaining = Math.max(0, Date.parse(target) - now);
  const totalSeconds = Math.floor(remaining / 1000);
  if (totalSeconds === 0) {
    return (
      <p className={`flex items-center gap-2 font-medium text-wine-700 ${compact ? "text-xs" : "text-sm"}`}>
        <Sparkles className="size-4 shrink-0 text-rose-500" aria-hidden />
        ¡{label === "Revelación" ? "La sorpresa se ha revelado" : "El momento llegó"}!
      </p>
    );
  }

  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const units = [
    ["d", days],
    ["h", hours],
    ["m", minutes],
    ["s", seconds],
  ] as const;

  return (
    <div className={`flex items-center gap-2 text-wine-700 ${compact ? "text-xs" : "text-sm"}`} aria-live="off">
      <Clock3 className="size-4 shrink-0 text-rose-500" aria-hidden />
      <span className="shrink-0">{label}:</span>
      <span className="flex flex-wrap gap-x-1 font-semibold tabular-nums" aria-label={`${days} días, ${hours} horas, ${minutes} minutos, ${seconds} segundos`}>
        {units.map(([unit, value]) => <span key={unit}>{value}{unit}</span>)}
      </span>
    </div>
  );
}
