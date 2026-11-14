"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { CalendarHeart, Camera, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { saveAppointment } from "@/features/appointments/actions";
import { appointmentCategories } from "@/lib/validation";
import type { AppointmentWithCover } from "@/lib/dal";
import type { FormState } from "@/lib/form";
import { Button } from "@/components/ui/button";
import { Alert, FormMessage } from "@/components/ui/alert";

const CATEGORY_LABELS: Record<(typeof appointmentCategories)[number], string> = {
  romantica: "Romántica",
  comida: "Comida",
  paseo: "Paseo",
  cine: "Cine",
  viaje: "Viaje",
  celebracion: "Celebración",
  otra: "Otra",
};
const ACCEPTED_IMAGES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function AppointmentForm({
  coupleId,
  date,
  appointment,
  onClose,
  onSaved,
}: {
  coupleId: string;
  date: string;
  appointment: AppointmentWithCover | null;
  onClose: () => void;
  onSaved: (state: FormState) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const coverPathRef = useRef<HTMLInputElement>(null);
  const requestKeyRef = useRef<string | null>(null);
  const [state, setState] = useState<FormState | null>(null);
  const [pending, startTransition] = useTransition();
  const [removeCover, setRemoveCover] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = formRef.current;
    if (!form || pending) return;
    const formData = new FormData(form);
    const file = formData.get("coverFile");
    formData.delete("coverFile");
    setState(null);

    startTransition(async () => {
      let uploadedPath: string | null = null;
      if (file instanceof File && file.size > 0) {
        if (!ACCEPTED_IMAGES.includes(file.type)) {
          setState({ status: "error", message: "Usa una imagen JPG, PNG o WebP." });
          return;
        }
        if (file.size > MAX_IMAGE_BYTES) {
          setState({ status: "error", message: "La portada debe pesar 5 MB o menos." });
          return;
        }

        const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
        uploadedPath = `${coupleId}/appointment-cover-${crypto.randomUUID()}.${extension}`;
        const supabase = createClient();
        try {
          const { error } = await supabase.storage
            .from("appointment-covers")
            .upload(uploadedPath, file, { contentType: file.type, upsert: false, cacheControl: "3600" });
          if (error) {
            setState({ status: "error", message: "No se pudo subir la portada. Inténtalo de nuevo." });
            return;
          }
        } catch {
          setState({ status: "error", message: "No hubo conexión para subir la portada. Inténtalo de nuevo." });
          return;
        }
        if (coverPathRef.current) coverPathRef.current.value = uploadedPath;
      } else if (removeCover && coverPathRef.current) {
        coverPathRef.current.value = "";
      }

      requestKeyRef.current ??= crypto.randomUUID();
      formData.set("requestKey", requestKeyRef.current);
      formData.set("imagePath", coverPathRef.current?.value ?? "");
      let result: FormState;
      try {
        result = await saveAppointment(formData);
      } catch {
        if (uploadedPath) {
          try {
            const { error: cleanupError } = await createClient().storage.from("appointment-covers").remove([uploadedPath]);
            if (cleanupError) {
              setState({ status: "error", message: "No se pudo guardar la cita ni limpiar la portada subida." });
              return;
            }
          } catch {
            setState({ status: "error", message: "No se pudo guardar la cita ni limpiar la portada subida." });
            return;
          }
          if (coverPathRef.current) coverPathRef.current.value = appointment?.image_path ?? "";
        }
        setState({ status: "error", message: "No se pudo guardar la cita por un problema de conexión. Inténtalo de nuevo." });
        return;
      }
      if (result.status === "error") {
        if (uploadedPath) {
          try {
            const { error: cleanupError } = await createClient().storage.from("appointment-covers").remove([uploadedPath]);
            if (cleanupError) {
              setState({ ...result, message: `${result.message} No se pudo limpiar la portada subida.` });
              return;
            }
          } catch {
            setState({ ...result, message: `${result.message} No se pudo limpiar la portada subida.` });
            return;
          }
          if (coverPathRef.current) coverPathRef.current.value = appointment?.image_path ?? "";
        }
        setState(result);
        return;
      }

      onSaved(result);
      onClose();
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/45 p-4"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section role="dialog" aria-modal="true" aria-labelledby="appointment-form-title" className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-line bg-cream-50 text-ink-900 shadow-2xl">
      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-5 p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-rose-500">
              <CalendarHeart className="size-4" aria-hidden />
              Cada momento juntos cuenta
            </p>
            <h2 id="appointment-form-title" className="mt-1 font-display text-3xl font-semibold text-wine-700">
              {appointment ? "Editar cita" : "Una nueva aventura"}
            </h2>
          </div>
          <Button type="button" variant="ghost" className="size-10 px-0" onClick={onClose} aria-label="Cerrar">
            <X className="size-5" aria-hidden />
          </Button>
        </div>

        {state && <FormMessage state={state} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-medium text-ink-700">Título</span>
            <input name="title" required maxLength={100} defaultValue={appointment?.title ?? ""} className={inputClass} />
            <FieldError state={state} name="title" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-700">Fecha</span>
            <input name="date" type="date" required defaultValue={appointment?.date ?? date} className={inputClass} />
            <FieldError state={state} name="date" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-700">Categoría</span>
            <select name="category" defaultValue={appointment?.category ?? "romantica"} className={inputClass}>
              {appointmentCategories.map((category) => (
                <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>
              ))}
            </select>
            <FieldError state={state} name="category" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-700">Hora de inicio</span>
            <input name="startTime" type="time" required defaultValue={appointment?.start_time.slice(0, 5) ?? "18:00"} className={inputClass} />
            <FieldError state={state} name="startTime" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-700">Hora de finalización (opcional)</span>
            <input name="endTime" type="time" defaultValue={appointment?.end_time?.slice(0, 5) ?? ""} className={inputClass} />
            <FieldError state={state} name="endTime" />
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-medium text-ink-700">Lugar</span>
            <input name="location" maxLength={200} defaultValue={appointment?.location ?? ""} placeholder="¿A dónde van?" className={inputClass} />
            <FieldError state={state} name="location" />
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-medium text-ink-700">Descripción o detalles</span>
            <textarea name="description" rows={3} maxLength={3000} defaultValue={appointment?.description ?? ""} placeholder="Cuéntense el plan..." className={`${inputClass} h-auto py-3`} />
            <FieldError state={state} name="description" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-700">Presupuesto estimado (opcional)</span>
            <input name="budget" type="number" min="0" max="99999999.99" step="0.01" defaultValue={appointment?.budget ?? ""} placeholder="0.00" className={inputClass} />
            <FieldError state={state} name="budget" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-700">Estado</span>
            <select name="status" defaultValue={appointment?.status ?? "planned"} disabled={!appointment} className={inputClass}>
              <option value="planned">Próxima</option>
              <option value="completed">Realizada</option>
              <option value="cancelled">Cancelada</option>
            </select>
            {!appointment && <input type="hidden" name="status" value="planned" />}
            <FieldError state={state} name="status" />
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-medium text-ink-700">Notas adicionales (opcional)</span>
            <textarea name="notes" rows={2} maxLength={3000} defaultValue={appointment?.notes ?? ""} className={`${inputClass} h-auto py-3`} />
            <FieldError state={state} name="notes" />
          </label>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <span className="text-sm font-medium text-ink-700">Imagen de portada (opcional)</span>
            {appointment?.coverUrl && !removeCover && (
              <div className="h-32 rounded-2xl bg-cover bg-center" style={{ backgroundImage: `url("${appointment.coverUrl}")` }} aria-label="Portada actual" />
            )}
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line px-4 py-2 text-sm text-wine-700 hover:bg-blush-100">
                <Camera className="size-4" aria-hidden />
                Elegir imagen
                <input name="coverFile" type="file" accept={ACCEPTED_IMAGES.join(",")} className="sr-only" onChange={() => setRemoveCover(false)} />
              </label>
              {appointment?.image_path && !removeCover && (
                <button type="button" onClick={() => setRemoveCover(true)} className="text-sm text-danger-700 underline">
                  Quitar portada
                </button>
              )}
              {removeCover && (
                <button type="button" onClick={() => setRemoveCover(false)} className="text-sm text-wine-700 underline">
                  Conservar portada
                </button>
              )}
              <span className="text-xs text-ink-500">JPG, PNG o WebP · máximo 5 MB</span>
            </div>
            <input ref={coverPathRef} type="hidden" name="imagePath" defaultValue={appointment?.image_path ?? ""} />
            <input type="hidden" name="appointmentId" value={appointment?.id ?? ""} />
            <FieldError state={state} name="imagePath" />
          </div>
        </div>

        <div className="flex flex-col-reverse justify-end gap-3 border-t border-line pt-4 sm:flex-row">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" pending={pending}>{pending ? "Guardando..." : appointment ? "Guardar cambios" : "Guardar cita"}</Button>
        </div>
      </form>
      </section>
    </div>
  );
}

const inputClass =
  "h-11 w-full rounded-xl border border-line bg-cream-50 px-4 text-[15px] text-ink-900 placeholder:text-ink-300 focus:border-wine-500 focus:outline-none focus:ring-2 focus:ring-blush-200 disabled:opacity-60";

function FieldError({ state, name }: { state: FormState | null; name: string }) {
  const message = state?.fieldErrors?.[name]?.[0];
  return message ? <Alert tone="error">{message}</Alert> : null;
}
