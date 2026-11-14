"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { CalendarRange, X } from "lucide-react";
import type { CalendarActivity } from "@/lib/dal";
import type { FormState } from "@/lib/form";
import { activityColors, personalActivityCategories } from "@/lib/validation";
import { savePersonalActivity } from "@/features/calendar/actions";
import { FormMessage } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const CATEGORY_LABELS: Record<(typeof personalActivityCategories)[number], string> = {
  university: "Universidad",
  work: "Trabajo",
  study: "Estudio",
  exercise: "Ejercicio",
  errands: "Diligencias",
  family: "Familia",
  personal: "Actividades personales",
  rest: "Descanso",
  other: "Otros",
};

const COLOR_LABELS: Record<(typeof activityColors)[number], string> = {
  "#C66B82": "Rosa",
  "#6277B8": "Azul",
  "#3B8A7B": "Verde",
  "#D28B44": "Naranja",
  "#8564A8": "Violeta",
  "#4F7D9B": "Turquesa",
};

const inputClass =
  "h-11 w-full rounded-xl border border-line bg-cream-50 px-4 text-[15px] text-ink-900 focus:border-wine-500 focus:outline-none focus:ring-2 focus:ring-blush-200";

export function ActivityForm({
  activity,
  date,
  onClose,
  onSaved,
}: {
  activity: CalendarActivity | null;
  date: string;
  onClose: () => void;
  onSaved: (state: FormState) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const requestKeyRef = useRef<string | null>(null);
  const [state, setState] = useState<FormState | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formRef.current || pending) return;
    const formData = new FormData(formRef.current);
    requestKeyRef.current ??= crypto.randomUUID();
    formData.set("requestKey", requestKeyRef.current);

    startTransition(async () => {
      try {
        const result = await savePersonalActivity(formData);
        if (result.status === "error") {
          setState(result);
          return;
        }
        onSaved(result);
        onClose();
      } catch {
        setState({ status: "error", message: "No se pudo guardar la actividad. Comprueba tu conexión e inténtalo de nuevo." });
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/45 p-3 sm:p-5"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="activity-form-title"
        className="max-h-[94dvh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-line bg-cream-50 text-ink-900 shadow-2xl"
      >
        <form ref={formRef} onSubmit={submit} className="flex flex-col gap-5 p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-sm text-wine-600">
                <CalendarRange className="size-4" aria-hidden />
                Tu agenda, a tu manera
              </p>
              <h2 id="activity-form-title" className="mt-1 font-display text-3xl font-semibold text-wine-700">
                {activity ? "Editar actividad" : "Nueva actividad"}
              </h2>
            </div>
            <Button type="button" variant="ghost" className="size-10 px-0" onClick={onClose} disabled={pending} aria-label="Cerrar">
              <X className="size-5" aria-hidden />
            </Button>
          </div>

          {state && <FormMessage state={state} />}
          <input type="hidden" name="activityId" value={activity?.id ?? ""} />

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-sm font-medium text-ink-700">Nombre</span>
              <input name="title" required maxLength={120} defaultValue={activity?.title ?? ""} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink-700">Fecha</span>
              <input name="activityDate" type="date" required defaultValue={activity?.activity_date ?? date} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink-700">Hora de inicio</span>
              <input name="startTime" type="time" required defaultValue={activity?.start_time.slice(0, 5) ?? "09:00"} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink-700">Hora de finalización</span>
              <input name="endTime" type="time" required defaultValue={activity?.end_time.slice(0, 5) ?? "10:00"} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink-700">Categoría</span>
              <select name="category" defaultValue={activity?.category ?? "personal"} className={inputClass}>
                {personalActivityCategories.map((category) => (
                  <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink-700">Color</span>
              <select name="color" defaultValue={activity?.color ?? activityColors[0]} className={inputClass}>
                {activityColors.map((color) => (
                  <option key={color} value={color}>{COLOR_LABELS[color]}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-sm font-medium text-ink-700">Ubicación (opcional)</span>
              <input name="location" maxLength={200} defaultValue={activity?.location ?? ""} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-sm font-medium text-ink-700">Descripción (opcional)</span>
              <textarea name="description" rows={3} maxLength={3000} defaultValue={activity?.description ?? ""} className={`${inputClass} h-auto py-3`} />
            </label>
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-sm font-medium text-ink-700">Notas personales · solo tú las ves</span>
              <textarea name="personalNotes" rows={2} maxLength={3000} defaultValue={activity?.personal_notes ?? ""} className={`${inputClass} h-auto py-3`} />
            </label>
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-sm font-medium text-ink-700">Privacidad</span>
              <select name="visibility" defaultValue={activity?.visibility ?? "private"} className={inputClass}>
                <option value="private">Privada · solo tú ves la actividad</option>
                <option value="availability">Mostrar disponibilidad · tu pareja ve que estás ocupado</option>
                <option value="shared">Compartida · tu pareja ve los detalles, excepto tus notas</option>
              </select>
              <span className="text-xs leading-5 text-ink-500">
                Las notas personales nunca se comparten. Los eventos privados tampoco se usan para calcular el tiempo libre de tu pareja.
              </span>
            </label>
          </div>

          <div className="flex flex-col-reverse justify-end gap-3 border-t border-line pt-4 sm:flex-row">
            <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>Cancelar</Button>
            <Button type="submit" pending={pending}>{pending ? "Guardando…" : "Guardar actividad"}</Button>
          </div>
        </form>
      </section>
    </div>
  );
}
