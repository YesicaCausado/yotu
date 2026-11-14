"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Film,
  Footprints,
  Heart,
  MapPin,
  PartyPopper,
  Plane,
  Plus,
  Sparkles,
  Trash2,
  UtensilsCrossed,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { AppointmentForm } from "@/features/appointments/appointment-form";
import { deleteAppointment } from "@/features/appointments/actions";
import { createClient } from "@/lib/supabase/client";
import { getCoupleAppointments } from "@/lib/dal";
import { todayIn } from "@/lib/dates";
import type { AppointmentWithCover } from "@/lib/dal";
import type { FormState } from "@/lib/form";
import { FormMessage } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const CATEGORY_LABELS: Record<string, string> = {
  romantica: "Romántica",
  comida: "Comida",
  paseo: "Paseo",
  cine: "Cine",
  viaje: "Viaje",
  celebracion: "Celebración",
  otra: "Otra",
};
const CATEGORY_ICONS: Record<string, typeof Heart> = {
  romantica: Heart,
  comida: UtensilsCrossed,
  paseo: Footprints,
  cine: Film,
  viaje: Plane,
  celebracion: PartyPopper,
  otra: Sparkles,
};
const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

type ViewFilter = "upcoming" | "completed" | "cancelled";
type CalendarMode = "month" | "week";

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function offsetDate(value: string, days: number) {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
}

function appointmentGroup(appointment: AppointmentWithCover, today: string): ViewFilter {
  if (appointment.status === "cancelled") return "cancelled";
  if (appointment.status === "completed" || appointment.date < today) return "completed";
  return "upcoming";
}

function dayLabel(value: string, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" }) {
  return new Intl.DateTimeFormat("es", { ...options, timeZone: "UTC" }).format(parseDate(value));
}

function getCalendarDays(date: string, mode: CalendarMode) {
  if (mode === "week") {
    const weekday = (parseDate(date).getUTCDay() + 6) % 7;
    const first = offsetDate(date, -weekday);
    return Array.from({ length: 7 }, (_, index) => offsetDate(first, index));
  }
  const [year, month] = date.split("-").map(Number);
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const mondayOffset = (firstOfMonth.getUTCDay() + 6) % 7;
  const first = offsetDate(isoDate(firstOfMonth), -mondayOffset);
  return Array.from({ length: 42 }, (_, index) => offsetDate(first, index));
}

export function AppointmentsWorkspace({
  appointments: initialAppointments,
  coupleId,
  timeZone,
}: {
  appointments: AppointmentWithCover[];
  coupleId: string;
  timeZone: string;
}) {
  const [appointments, setAppointments] = useState(initialAppointments);
  const today = todayIn(timeZone);
  const [filter, setFilter] = useState<ViewFilter>("upcoming");
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("month");
  const [selectedDate, setSelectedDate] = useState(today);
  const [activeAppointmentId, setActiveAppointmentId] = useState<string | null>(null);
  const [formAppointment, setFormAppointment] = useState<AppointmentWithCover | null | undefined>(undefined);
  const [formDate, setFormDate] = useState(today);
  const [actionState, setActionState] = useState<FormState | null>(null);
  const [pending, startTransition] = useTransition();
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  const refreshAppointments = useCallback(async () => {
    const updated = await getCoupleAppointments(coupleId);
    setAppointments(updated);
  }, [coupleId]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`appointments:${coupleId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments", filter: `couple_id=eq.${coupleId}` },
        () => {
          void refreshAppointments().catch(() => {
            setActionState({ status: "error", message: "No se pudo sincronizar el calendario. Actualiza la página." });
          });
        },
      )
      .subscribe((status) => {
        setRealtimeConnected(status === "SUBSCRIBED");
        if (status === "SUBSCRIBED") {
          void refreshAppointments().catch(() => {
            setActionState({ status: "error", message: "No se pudo sincronizar el calendario. Actualiza la página." });
          });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [coupleId, refreshAppointments]);

  const grouped = useMemo(() => {
    const groups: Record<ViewFilter, AppointmentWithCover[]> = {
      upcoming: [],
      completed: [],
      cancelled: [],
    };
    for (const appointment of appointments) groups[appointmentGroup(appointment, today)].push(appointment);
    return groups;
  }, [appointments, today]);
  const filtered = grouped[filter];
  const calendarDays = useMemo(() => getCalendarDays(selectedDate, calendarMode), [calendarMode, selectedDate]);
  const byDate = useMemo(() => {
    const map = new Map<string, AppointmentWithCover[]>();
    for (const appointment of appointments) {
      const current = map.get(appointment.date) ?? [];
      current.push(appointment);
      map.set(appointment.date, current);
    }
    return map;
  }, [appointments]);
  const activeAppointment = appointments.find((appointment) => appointment.id === activeAppointmentId) ?? null;

  function openCreate(date: string) {
    setFormDate(date);
    setFormAppointment(null);
  }

  function moveCalendar(direction: number) {
    setSelectedDate(offsetDate(selectedDate, calendarMode === "week" ? 7 * direction : 0));
    if (calendarMode === "month") {
      const date = parseDate(selectedDate);
      date.setUTCMonth(date.getUTCMonth() + direction);
      setSelectedDate(isoDate(date));
    }
  }

  function remove(appointment: AppointmentWithCover) {
    if (!window.confirm(`¿Eliminar "${appointment.title}"? Esta acción no se puede deshacer.`)) return;
    startTransition(async () => {
      try {
        const result = await deleteAppointment(appointment.id);
        setActionState(result);
        if (result.status === "success") {
          setActiveAppointmentId(null);
          await refreshAppointments();
        }
      } catch {
        setActionState({ status: "error", message: "No se pudo eliminar la cita por un problema de conexión." });
      }
    });
  }

  const calendarTitle =
    calendarMode === "month"
      ? new Intl.DateTimeFormat("es", { month: "long", year: "numeric", timeZone: "UTC" }).format(parseDate(selectedDate))
      : `${dayLabel(calendarDays[0], { day: "numeric", month: "short" })} – ${dayLabel(calendarDays[6], { day: "numeric", month: "long", year: "numeric" })}`;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 flex items-center gap-2 text-sm text-rose-500"><Heart className="size-4 fill-current" aria-hidden /> Cada momento juntos cuenta</p>
          <h1 className="font-display text-4xl font-semibold text-wine-700">Nuestras citas</h1>
          <p className="mt-1 text-sm text-ink-500">Un calendario para todo lo que quieren vivir juntos.</p>
        </div>
        <Button onClick={() => openCreate(selectedDate)}><Plus className="size-4" aria-hidden /> Nueva cita</Button>
      </header>

      <div className="flex items-center justify-between rounded-2xl bg-blush-100 px-4 py-3 text-xs text-wine-700">
        <span className="flex items-center gap-2">
          {realtimeConnected ? <Wifi className="size-4" aria-hidden /> : <WifiOff className="size-4" aria-hidden />}
          {realtimeConnected ? "Sincronizado con tu pareja" : "Conectando el calendario compartido…"}
        </span>
        {!realtimeConnected && (
          <button
            className="underline"
            onClick={() => {
              void refreshAppointments().catch(() => setActionState({ status: "error", message: "No se pudo actualizar el calendario." }));
            }}
          >
            Actualizar
          </button>
        )}
      </div>
      {actionState && <FormMessage state={actionState} />}

      <Card>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-5 text-wine-600" aria-hidden />
            <h2 className="font-display text-2xl font-semibold capitalize text-wine-700">Calendario compartido</h2>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-cream-100 p-1">
            {(["month", "week"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setCalendarMode(mode)}
                aria-pressed={calendarMode === mode}
                className="rounded-full px-3 py-1.5 text-xs font-medium text-ink-500 transition-colors aria-pressed:bg-cream-50 aria-pressed:text-wine-700"
              >
                {mode === "month" ? "Mes" : "Semana"}
              </button>
            ))}
          </div>
        </div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" className="size-9 px-0" onClick={() => moveCalendar(-1)} aria-label="Periodo anterior">
              <ChevronLeft className="size-5" aria-hidden />
            </Button>
            <p className="min-w-36 text-center text-sm font-medium capitalize text-ink-700">{calendarTitle}</p>
            <Button type="button" variant="ghost" className="size-9 px-0" onClick={() => moveCalendar(1)} aria-label="Periodo siguiente">
              <ChevronRight className="size-5" aria-hidden />
            </Button>
          </div>
          <Button type="button" variant="secondary" className="h-9 px-3 text-xs" onClick={() => setSelectedDate(today)}>Hoy</Button>
        </div>
        <div className="grid grid-cols-7 border-b border-line pb-2 text-center text-xs font-medium text-ink-500">
          {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
        </div>
        <div className={`grid grid-cols-7 ${calendarMode === "month" ? "" : "grid-rows-1"}`}>
          {calendarDays.map((date) => {
            const dayAppointments = byDate.get(date) ?? [];
            const inMonth = date.slice(0, 7) === selectedDate.slice(0, 7);
            return (
              <div
                key={date}
                className={`min-h-20 border-b border-line/70 px-1 py-1.5 sm:min-h-24 sm:px-2 ${calendarMode === "month" && !inMonth ? "opacity-45" : ""} ${selectedDate === date ? "bg-blush-100/70" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedDate(date)}
                  aria-label={dayLabel(date, { weekday: "long", day: "numeric", month: "long" })}
                  aria-pressed={selectedDate === date}
                  className={`mx-auto flex size-7 items-center justify-center rounded-full text-xs ${date === today ? "bg-wine-600 font-semibold text-white" : "text-ink-700"} ${selectedDate === date && date !== today ? "ring-1 ring-wine-500" : ""}`}
                >
                  {Number(date.slice(-2))}
                </button>
                <div className="mt-1 flex flex-col gap-0.5">
                  {dayAppointments.slice(0, calendarMode === "week" ? 4 : 2).map((appointment) => (
                    <button
                      key={appointment.id}
                      type="button"
                      onClick={() => setActiveAppointmentId(appointment.id)}
                      title={`${appointment.start_time.slice(0, 5)} · ${appointment.title}`}
                      className={`truncate rounded-md px-1 py-0.5 text-left text-[10px] leading-4 sm:text-xs ${appointment.status === "cancelled" ? "bg-cream-200 text-ink-500 line-through" : appointmentGroup(appointment, today) === "completed" ? "bg-success-50 text-success-700" : "bg-blush-200 text-wine-700"}`}
                    >
                      {appointment.title}
                    </button>
                  ))}
                  {dayAppointments.length > (calendarMode === "week" ? 4 : 2) && (
                    <span className="px-1 text-[10px] text-ink-500">+{dayAppointments.length - (calendarMode === "week" ? 4 : 2)} más</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-sm font-medium capitalize text-ink-700">{dayLabel(selectedDate, { weekday: "long", day: "numeric", month: "long" })}</p>
          <Button type="button" variant="secondary" className="h-9 px-3 text-xs" onClick={() => openCreate(selectedDate)}>
            <Plus className="size-4" aria-hidden /> Crear para este día
          </Button>
        </div>
        {(byDate.get(selectedDate)?.length ?? 0) > 0 ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {byDate.get(selectedDate)?.map((appointment) => (
              <button
                key={appointment.id}
                type="button"
                onClick={() => setActiveAppointmentId(appointment.id)}
                className="flex items-center gap-3 rounded-2xl border border-line bg-cream-100 p-3 text-left transition-colors hover:bg-blush-100"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-cream-50 text-wine-600">
                  <Clock3 className="size-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink-900">{appointment.title}</span>
                  <span className="block text-xs text-ink-500">{appointment.start_time.slice(0, 5)} · {CATEGORY_LABELS[appointment.category] ?? appointment.category}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink-500">Un día perfecto para planear algo especial ✨</p>
        )}
      </Card>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold text-wine-700">Sus planes</h2>
            <p className="mt-1 text-sm text-ink-500">¡Una nueva aventura está por comenzar!</p>
          </div>
          <div role="tablist" aria-label="Filtrar citas" className="flex gap-1 rounded-full bg-cream-200 p-1">
            {([
              ["upcoming", "Próximas"],
              ["completed", "Realizadas"],
              ["cancelled", "Canceladas"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={filter === key}
                onClick={() => setFilter(key)}
                className="rounded-full px-3 py-2 text-xs font-medium text-ink-500 transition-colors aria-selected:bg-cream-50 aria-selected:text-wine-700"
              >
                {label} <span className="ml-1 opacity-70">{grouped[key].length}</span>
              </button>
            ))}
          </div>
        </div>
        {appointments.length === 0 ? (
          <Card className="text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-blush-100 text-rose-500">
              <Heart className="size-7 fill-current" aria-hidden />
            </div>
            <h3 className="mt-4 font-display text-2xl font-semibold text-wine-700">Todavía no tienen citas planeadas ❤️</h3>
            <p className="mt-2 text-sm text-ink-500">Cada momento juntos cuenta. ¡Empiecen con un plan que les ilusione!</p>
            <Button className="mt-5" onClick={() => openCreate(today)}><Plus className="size-4" aria-hidden /> Crear primera cita</Button>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="text-center text-sm text-ink-500">Todavía no hay citas en esta categoría.</Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filtered.map((appointment) => (
              <AppointmentCard
                key={appointment.id}
                appointment={appointment}
                group={filter}
                pending={pending}
                onOpen={() => setActiveAppointmentId(appointment.id)}
                onEdit={() => { setFormDate(appointment.date); setFormAppointment(appointment); }}
                onDelete={() => remove(appointment)}
              />
            ))}
          </div>
        )}
      </section>

      {formAppointment !== undefined && (
        <AppointmentForm
          key={formAppointment?.id ?? "new"}
          coupleId={coupleId}
          date={formDate}
          appointment={formAppointment}
          onClose={() => setFormAppointment(undefined)}
          onSaved={(result) => {
            setActionState(result);
            void refreshAppointments().catch(() => setActionState({ status: "error", message: "La cita se guardó, pero no se pudo actualizar el calendario." }));
          }}
        />
      )}
      {activeAppointment && (
        <AppointmentDetails
          appointment={activeAppointment}
          group={appointmentGroup(activeAppointment, today)}
          pending={pending}
          onClose={() => setActiveAppointmentId(null)}
          onEdit={() => { setFormDate(activeAppointment.date); setFormAppointment(activeAppointment); setActiveAppointmentId(null); }}
          onDelete={() => remove(activeAppointment)}
        />
      )}
    </div>
  );
}

function AppointmentCard({
  appointment,
  group,
  pending,
  onOpen,
  onEdit,
  onDelete,
}: {
  appointment: AppointmentWithCover;
  group: ViewFilter;
  pending: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const Icon = CATEGORY_ICONS[appointment.category] ?? Sparkles;
  const statusLabel = group === "upcoming" ? "Próxima" : group === "completed" ? "Realizada" : "Cancelada";
  return (
    <Card className="overflow-hidden p-0">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div
          className="relative h-40 bg-gradient-to-br from-blush-200 via-cream-200 to-rose-500/30 bg-cover bg-center"
          style={appointment.coverUrl ? { backgroundImage: `url("${appointment.coverUrl}")` } : undefined}
        >
          {!appointment.coverUrl && <Heart className="absolute right-5 top-5 size-9 text-wine-500/35" aria-hidden />}
          <span className="absolute left-3 top-3 rounded-full bg-cream-50/90 px-3 py-1 text-xs font-medium text-wine-700">{statusLabel}</span>
        </div>
        <div className="p-5">
          <p className="flex items-center gap-2 text-xs text-wine-600"><Icon className="size-4" aria-hidden /> {CATEGORY_LABELS[appointment.category] ?? appointment.category}</p>
          <h3 className="mt-2 truncate font-display text-2xl font-semibold text-wine-700">{appointment.title}</h3>
          <p className="mt-2 flex items-center gap-2 text-sm text-ink-500">
            <CalendarDays className="size-4 shrink-0" aria-hidden /> {dayLabel(appointment.date)} · {appointment.start_time.slice(0, 5)}
            {appointment.end_time && ` – ${appointment.end_time.slice(0, 5)}`}
          </p>
          {appointment.location && <p className="mt-1 flex items-center gap-2 truncate text-sm text-ink-500"><MapPin className="size-4 shrink-0" aria-hidden /> {appointment.location}</p>}
        </div>
      </button>
      <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
        <Button type="button" variant="ghost" className="h-9 px-3 text-xs" onClick={onEdit}>Editar</Button>
        <Button type="button" variant="ghost" className="h-9 px-3 text-xs text-danger-700" onClick={onDelete} disabled={pending}>
          <Trash2 className="size-4" aria-hidden /> Eliminar
        </Button>
      </div>
    </Card>
  );
}

function AppointmentDetails({
  appointment,
  group,
  pending,
  onClose,
  onEdit,
  onDelete,
}: {
  appointment: AppointmentWithCover;
  group: ViewFilter;
  pending: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink-900/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="appointment-details-title" className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl bg-cream-50 shadow-2xl">
        <div
          className="relative h-48 bg-gradient-to-br from-blush-200 to-rose-500/30 bg-cover bg-center"
          style={appointment.coverUrl ? { backgroundImage: `url("${appointment.coverUrl}")` } : undefined}
        >
          <button type="button" onClick={onClose} aria-label="Cerrar detalles" className="absolute right-3 top-3 flex size-10 items-center justify-center rounded-full bg-cream-50/90 text-wine-700">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="p-6">
          <p className="text-sm font-medium text-rose-500">{CATEGORY_LABELS[appointment.category] ?? appointment.category} · {group === "upcoming" ? "Próxima" : group === "completed" ? "Realizada" : "Cancelada"}</p>
          <h2 id="appointment-details-title" className="mt-1 font-display text-3xl font-semibold text-wine-700">{appointment.title}</h2>
          <p className="mt-3 flex items-center gap-2 text-sm text-ink-700"><CalendarDays className="size-4 text-wine-600" aria-hidden /> {dayLabel(appointment.date)} · {appointment.start_time.slice(0, 5)}{appointment.end_time && ` – ${appointment.end_time.slice(0, 5)}`}</p>
          {appointment.location && <p className="mt-2 flex items-center gap-2 text-sm text-ink-700"><MapPin className="size-4 text-wine-600" aria-hidden /> {appointment.location}</p>}
          {appointment.description && <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-ink-700">{appointment.description}</p>}
          {appointment.budget !== null && <p className="mt-3 text-sm text-ink-500">Presupuesto: {new Intl.NumberFormat("es", { style: "currency", currency: "USD" }).format(appointment.budget)}</p>}
          {appointment.notes && <p className="mt-3 rounded-2xl bg-blush-100 p-3 text-sm text-ink-700">{appointment.notes}</p>}
          <div className="mt-6 flex justify-end gap-2 border-t border-line pt-4">
            <Button type="button" variant="secondary" onClick={onEdit}>Editar cita</Button>
            <Button type="button" variant="danger" onClick={onDelete} disabled={pending}><Trash2 className="size-4" aria-hidden /> Eliminar</Button>
          </div>
        </div>
      </section>
    </div>
  );
}
