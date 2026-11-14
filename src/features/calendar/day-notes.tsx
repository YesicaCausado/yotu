"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { Bell, Check, Circle, Pencil, Plus, Trash2 } from "lucide-react";
import { deletePersonalDayNote, savePersonalDayNote, setPersonalTaskCompleted } from "@/features/calendar/actions";
import { getPersonalDayNotes } from "@/lib/dal";
import type { PersonalDayNote } from "@/types/database";
import { createClient } from "@/lib/supabase/client";
import { FormMessage } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import type { FormState } from "@/lib/form";

function localDateTimeValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function reminderLabel(value: string) {
  return new Intl.DateTimeFormat("es", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function DayNotes({ date, userId }: { date: string; userId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const requestKeyRef = useRef<string | null>(null);
  const [notes, setNotes] = useState<PersonalDayNote[]>([]);
  const [editing, setEditing] = useState<PersonalDayNote | null>(null);
  const [message, setMessage] = useState<FormState | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void getPersonalDayNotes(date)
        .then((items) => {
          if (active) {
            setNotes(items);
            setLoadError(false);
          }
        })
        .catch(() => {
          if (active) setLoadError(true);
        });
    };

    const supabase = createClient();
    const channel = supabase
      .channel(`personal-notes:${userId}:${date}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "personal_day_notes", filter: `user_id=eq.${userId}` },
        refresh,
      )
      .subscribe();
    refresh();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [date, userId]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formRef.current || pending) return;

    const formData = new FormData(formRef.current);
    formData.set("id", editing?.id ?? "");
    formData.set("noteDate", date);
    formData.set("requestKey", editing?.request_key ?? (requestKeyRef.current ??= crypto.randomUUID()));
    startTransition(async () => {
      try {
        const result = await savePersonalDayNote(formData);
        setMessage(result);
        if (result.status === "success") {
          setEditing(null);
          requestKeyRef.current = null;
          formRef.current?.reset();
          try {
            setNotes(await getPersonalDayNotes(date));
          } catch {
            setLoadError(true);
          }
        }
      } catch {
        setMessage({ status: "error", message: "No se pudo guardar la nota. Comprueba tu conexión e inténtalo de nuevo." });
      }
    });
  }

  function toggleTask(note: PersonalDayNote) {
    startTransition(async () => {
      try {
        const result = await setPersonalTaskCompleted(note.id, !note.is_completed);
        setMessage(result);
        if (result.status === "success") setNotes(await getPersonalDayNotes(date));
      } catch {
        setMessage({ status: "error", message: "No se pudo actualizar el pendiente." });
      }
    });
  }

  function remove(note: PersonalDayNote) {
    if (!window.confirm(`¿Eliminar "${note.title}"?`)) return;
    startTransition(async () => {
      try {
        const result = await deletePersonalDayNote(note.id);
        setMessage(result);
        if (result.status === "success") setNotes(await getPersonalDayNotes(date));
      } catch {
        setMessage({ status: "error", message: "No se pudo eliminar la nota." });
      }
    });
  }

  return (
    <Card>
      <CardHeader
        title="Notas y pendientes"
        description="Este espacio es privado y solo tú puedes consultarlo."
      />
      {message && <div className="mb-4"><FormMessage state={message} /></div>}
      {loadError && <p role="alert" className="mb-4 text-sm text-danger-700">No se pudieron cargar tus notas. Vuelve a intentarlo.</p>}

      {notes.length > 0 ? (
        <ul className="mb-5 divide-y divide-line">
          {notes.map((note) => (
            <li key={note.id} className="flex items-start gap-3 py-3 first:pt-0">
              {note.is_task ? (
                <button
                  type="button"
                  aria-label={note.is_completed ? "Reabrir pendiente" : "Marcar pendiente como completado"}
                  onClick={() => toggleTask(note)}
                  disabled={pending}
                  className="mt-0.5 shrink-0 text-wine-600"
                >
                  {note.is_completed ? <Check className="size-5" aria-hidden /> : <Circle className="size-5" aria-hidden />}
                </button>
              ) : <span className="mt-0.5 size-5 shrink-0 rounded-full bg-blush-100" aria-hidden />}
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium text-ink-800 ${note.is_completed ? "line-through opacity-60" : ""}`}>
                  {note.title}
                  {note.is_task && <span className="ml-2 text-xs text-wine-600">Pendiente</span>}
                </p>
                {note.content && <p className="mt-1 whitespace-pre-wrap text-sm text-ink-500">{note.content}</p>}
                {note.reminder_at && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-wine-600">
                    <Bell className="size-3.5" aria-hidden /> {reminderLabel(note.reminder_at)}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  aria-label={`Editar ${note.title}`}
                  onClick={() => { setEditing(note); setMessage(null); }}
                  className="rounded-full p-2 text-ink-500 hover:bg-blush-100 hover:text-wine-700"
                >
                  <Pencil className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={`Eliminar ${note.title}`}
                  onClick={() => remove(note)}
                  disabled={pending}
                  className="rounded-full p-2 text-ink-500 hover:bg-danger-50 hover:text-danger-700"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-5 text-sm text-ink-500">Sin notas por ahora. Guarda aquí tus ideas y recordatorios del día.</p>
      )}

      <form
        key={editing?.id ?? "new-note"}
        ref={formRef}
        onSubmit={submit}
        className="grid gap-3 border-t border-line pt-4"
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink-700">{editing ? "Editar nota" : "Nueva nota o pendiente"}</span>
          <input name="title" required maxLength={120} defaultValue={editing?.title ?? ""} placeholder="¿Qué quieres recordar?" className={inputClass} />
        </label>
        <textarea name="content" rows={2} maxLength={5000} defaultValue={editing?.content ?? ""} placeholder="Detalles (opcional)" className={`${inputClass} h-auto py-3`} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-600">Recordatorio (opcional)</span>
            <input name="reminderAt" type="datetime-local" defaultValue={localDateTimeValue(editing?.reminder_at ?? null)} className={inputClass} />
          </label>
          <label className="flex items-center gap-2 self-end pb-3 text-sm text-ink-700">
            <input name="isTask" type="checkbox" defaultChecked={editing?.is_task ?? false} className="size-4 accent-wine-600" />
            Guardar como pendiente
          </label>
        </div>
        <div className="flex justify-end gap-2">
          {editing && <Button type="button" variant="secondary" onClick={() => setEditing(null)} disabled={pending}>Cancelar</Button>}
          <Button type="submit" variant={editing ? "primary" : "secondary"} pending={pending}>
            <Plus className="size-4" aria-hidden /> {pending ? "Guardando…" : editing ? "Guardar cambios" : "Añadir al día"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

const inputClass =
  "h-11 w-full rounded-xl border border-line bg-cream-50 px-4 text-sm text-ink-900 focus:border-wine-500 focus:outline-none focus:ring-2 focus:ring-blush-200";
