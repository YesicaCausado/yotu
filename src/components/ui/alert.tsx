import { CircleAlert, CircleCheck, Info } from "lucide-react";
import type { ReactNode } from "react";

type Tone = "error" | "success" | "info";

const tones: Record<Tone, { className: string; Icon: typeof Info }> = {
  error: { className: "bg-danger-50 text-danger-700 border-danger-700/15", Icon: CircleAlert },
  success: { className: "bg-success-50 text-success-700 border-success-700/15", Icon: CircleCheck },
  info: { className: "bg-blush-100 text-wine-700 border-wine-500/15", Icon: Info },
};

export function Alert({ tone = "info", children }: { tone?: Tone; children: ReactNode }) {
  const { className, Icon } = tones[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm animate-fade-in ${className}`}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

/** Muestra el mensaje general de un FormState (si lo hay). */
export function FormMessage({ state }: { state: { status: string; message?: string } }) {
  if (!state.message || state.status === "idle") return null;
  return <Alert tone={state.status === "error" ? "error" : "success"}>{state.message}</Alert>;
}
