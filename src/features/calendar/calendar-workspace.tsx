"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  CalendarDays,
  CalendarHeart,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Heart,
  MapPin,
  Plus,
  Sparkles,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { ActivityForm } from "@/features/calendar/activity-form";
import { DayNotes } from "@/features/calendar/day-notes";
import { deletePersonalActivity } from "@/features/calendar/actions";
import { AppointmentForm } from "@/features/appointments/appointment-form";
import { createClient } from "@/lib/supabase/client";
import { getCalendarActivities, getCoupleAppointments, type AppointmentWithCover, type CalendarActivity } from "@/lib/dal";
import {
  AVAILABILITY_END,
  AVAILABILITY_START,
  dayLabel,
  findFreeSlots,
  getCalendarDays,
  MINIMUM_FREE_SLOT,
  offsetDate,
  parseDate,
  type CalendarView,
  type TimedBlock,
} from "@/lib/calendar";
import { todayIn } from "@/lib/dates";
import type { FormState } from "@/lib/form";
import { FormMessage } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const ACTIVITY_CATEGORIES: Record<string, string> = {
  university: "Universidad",
  work: "Trabajo",
  study: "Estudio",
  exercise: "Ejercicio",
  errands: "Diligencias",
  family: "Familia",
  personal: "Personal",
  rest: "Descanso",
  other: "Otros",
};

const APPOINTMENT_CATEGORIES: Record<string, string> = {
  romantica: "Romántica",
  comida: "Comida",
  paseo: "Paseo",
  cine: "Cine",
  viaje: "Viaje",
  celebracion: "Celebración",
  otra: "Otra",
};

type CalendarFilter = "combined" | "mine" | "partner";
type AppointmentDraft = { date: string; startTime: string };
type Partner = { id: string; name: string };

function movePeriod(dateValue: string, view: CalendarView, direction: number) {
  if (view === "day") return offsetDate(dateValue, direction);
  if (view === "week") return offsetDate(dateValue, 7 * direction);
  const date = parseDate(dateValue);
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + direction);
  return date.toISOString().slice(0, 10);
}

function formatTime(value: string) {
  return value.slice(0, 5);
}

function formatMinutes(value: number) {
  const hours = String(Math.floor(value / 60)).padStart(2, "0");
  const minutes = String(value % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function calendarTitle(view: CalendarView, date: string, days: string[]) {
  if (view === "day") {
    return dayLabel(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }
  if (view === "week") {
    return `${dayLabel(days[0], { day: "numeric", month: "short" })} – ${dayLabel(days[6], {
      day: "numeric",
      month: "long",
      year: "numeric",
    })}`;
  }
  return new Intl.DateTimeFormat("es", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(parseDate(date));
}

function activityColor(activity: CalendarActivity, userId: string) {
  return activity.visibility === "availability" && activity.owner_id !== userId ? "#A8A29E" : activity.color;
}

export function CalendarWorkspace({
  coupleId,
  timeZone,
  userId,
  partner,
}: {
  coupleId: string;
  timeZone: string;
  userId: string;
  partner: Partner | null;
}) {
  const today = todayIn(timeZone);
  const [selectedDate, setSelectedDate] = useState(today);
  const [view, setView] = useState<CalendarView>("month");
  const [filter, setFilter] = useState<CalendarFilter>("combined");
  const [availabilityView, setAvailabilityView] = useState<"day" | "week">("day");
  const [activities, setActivities] = useState<CalendarActivity[]>([]);
  const [appointments, setAppointments] = useState<AppointmentWithCover[]>([]);
  const [loadedRange, setLoadedRange] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [formActivity, setFormActivity] = useState<{ date: string; activity: CalendarActivity | null } | null>(null);
  const [appointmentDraft, setAppointmentDraft] = useState<AppointmentDraft | null>(null);
  const [activeActivityId, setActiveActivityId] = useState<string | null>(null);
  const [activeAppointmentId, setActiveAppointmentId] = useState<string | null>(null);
  const [message, setMessage] = useState<FormState | null>(null);
  const [pending, startTransition] = useTransition();

  const calendarDays = useMemo(() => getCalendarDays(selectedDate, view), [selectedDate, view]);
  const rangeStart = calendarDays[0];
  const rangeEnd = calendarDays[calendarDays.length - 1];
  const rangeKey = `${rangeStart}:${rangeEnd}`;

  const fetchCalendar = useCallback(async () => {
    const [activityRows, appointmentRows] = await Promise.all([
      getCalendarActivities(rangeStart, rangeEnd),
      getCoupleAppointments(coupleId),
    ]);
    return { activityRows, appointmentRows };
  }, [coupleId, rangeEnd, rangeStart]);
  const refreshCalendar = useCallback(async () => {
    const { activityRows, appointmentRows } = await fetchCalendar();
    setActivities(activityRows);
    setAppointments(appointmentRows);
  }, [fetchCalendar]);

  useEffect(() => {
    let active = true;
    fetchCalendar()
      .then(({ activityRows, appointmentRows }) => {
        if (active) {
          setActivities(activityRows);
          setAppointments(appointmentRows);
          setLoadedRange(rangeKey);
          setLoadError(false);
        }
      })
      .catch(() => {
        if (active) setLoadError(true);
      });
    return () => {
      active = false;
    };
  }, [fetchCalendar, rangeKey]);

  useEffect(() => {
    const supabase = createClient();
    const refreshFromRealtime = () => {
      void refreshCalendar().catch(() => {
        setMessage({ status: "error", message: "No se pudo sincronizar el calendario. Actualiza la página." });
      });
    };
    const channel = supabase
      .channel(`couple-calendar:${coupleId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calendar_sync_state", filter: `couple_id=eq.${coupleId}` },
        refreshFromRealtime,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments", filter: `couple_id=eq.${coupleId}` },
        refreshFromRealtime,
      )
      .subscribe((status) => {
        setRealtimeConnected(status === "SUBSCRIBED");
        if (status === "SUBSCRIBED") refreshFromRealtime();
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [coupleId, refreshCalendar]);

  const visibleActivities = useMemo(
    () => activities.filter((activity) =>
      filter === "combined"
        || (filter === "mine" && activity.owner_id === userId)
        || (filter === "partner" && activity.owner_id !== userId)),
    [activities, filter, userId],
  );
  const visibleAppointments = useMemo(
    () => appointments.filter((appointment) => appointment.status !== "cancelled"),
    [appointments],
  );
  const activitiesByDate = useMemo(() => groupByDate(visibleActivities, (activity) => activity.activity_date), [visibleActivities]);
  const appointmentsByDate = useMemo(() => groupByDate(visibleAppointments, (appointment) => appointment.date), [visibleAppointments]);
  const selectedActivities = activitiesByDate.get(selectedDate) ?? [];
  const selectedAppointments = appointmentsByDate.get(selectedDate) ?? [];
  const activeActivity = activities.find((activity) => activity.id === activeActivityId) ?? null;
  const activeAppointment = appointments.find((appointment) => appointment.id === activeAppointmentId) ?? null;
  const busyBlocks: TimedBlock[] = useMemo(() => [
    ...activities.map((activity) => ({
      date: activity.activity_date,
      start_time: activity.start_time,
      end_time: activity.end_time,
    })),
    ...appointments
      .filter((appointment) => appointment.status === "planned")
      .map((appointment) => ({
        date: appointment.date,
        start_time: appointment.start_time,
        end_time: appointment.end_time,
      })),
  ], [activities, appointments]);
  const availabilityDays = availabilityView === "day"
    ? [selectedDate]
    : getCalendarDays(selectedDate, "week");
  const isLoading = loadedRange !== rangeKey && !loadError;

  function openAppointment(date: string, startTime = "18:00") {
    setAppointmentDraft({ date, startTime });
  }

  function removeActivity(activity: CalendarActivity) {
    if (activity.owner_id !== userId || !window.confirm(`¿Eliminar "${activity.title ?? "esta actividad"}"?`)) return;
    startTransition(async () => {
      try {
        const result = await deletePersonalActivity(activity.id);
        setMessage(result);
        if (result.status === "success") {
          setActiveActivityId(null);
          await refreshCalendar();
        }
      } catch {
        setMessage({ status: "error", message: "No se pudo eliminar la actividad. Comprueba tu conexión." });
      }
    });
  }

  function retry() {
    setLoadError(false);
    refreshCalendar()
      .then(() => {
        setLoadedRange(rangeKey);
        setLoadError(false);
      })
      .catch(() => setLoadError(true));
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 flex items-center gap-2 text-sm text-wine-600">
            <Heart className="size-4 fill-current" aria-hidden /> Organizarse también es cuidarse
          </p>
          <h1 className="font-display text-4xl font-semibold text-wine-700">Calendario compartido</h1>
          <p className="mt-1 text-sm text-ink-500">Tus actividades, sus horarios visibles y tiempo para ustedes.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setFormActivity({ date: selectedDate, activity: null })}>
            <Plus className="size-4" aria-hidden /> Actividad
          </Button>
          <Button onClick={() => openAppointment(selectedDate)}>
            <CalendarHeart className="size-4" aria-hidden /> Nueva cita
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-blush-100 px-4 py-3 text-xs text-wine-700">
        <span className="flex items-center gap-2">
          {realtimeConnected ? <Wifi className="size-4" aria-hidden /> : <WifiOff className="size-4" aria-hidden />}
          {realtimeConnected ? "Calendarios sincronizados" : "Conectando la sincronización…"}
        </span>
        <div className="flex items-center gap-3">
          <span>Zona horaria: {timeZone}</span>
          {!realtimeConnected && <button type="button" className="underline" onClick={retry}>Actualizar</button>}
        </div>
      </div>
      {message && <FormMessage state={message} />}

      <Card>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarRange className="size-5 text-wine-600" aria-hidden />
            <h2 className="font-display text-2xl font-semibold text-wine-700">Agenda de los dos</h2>
          </div>
          <div role="tablist" aria-label="Calendarios visibles" className="flex max-w-full gap-1 overflow-x-auto rounded-full bg-cream-100 p-1">
            {([
              ["combined", "Combinado"],
              ["mine", "Mi calendario"],
              ["partner", "Pareja"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={filter === key}
                onClick={() => setFilter(key)}
                className="whitespace-nowrap rounded-full px-3 py-2 text-xs font-medium text-ink-500 transition-colors aria-selected:bg-cream-50 aria-selected:text-wine-700"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" className="size-9 px-0" onClick={() => setSelectedDate(movePeriod(selectedDate, view, -1))} aria-label="Periodo anterior">
              <ChevronLeft className="size-5" aria-hidden />
            </Button>
            <p className="min-w-40 text-center text-sm font-medium capitalize text-ink-700">
              {calendarTitle(view, selectedDate, calendarDays)}
            </p>
            <Button type="button" variant="ghost" className="size-9 px-0" onClick={() => setSelectedDate(movePeriod(selectedDate, view, 1))} aria-label="Periodo siguiente">
              <ChevronRight className="size-5" aria-hidden />
            </Button>
            <Button type="button" variant="secondary" className="ml-1 h-9 px-3 text-xs" onClick={() => setSelectedDate(today)}>Hoy</Button>
          </div>
          <div className="flex gap-1 rounded-full bg-cream-100 p-1">
            {(["day", "week", "month"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={view === mode}
                onClick={() => setView(mode)}
                className="rounded-full px-3 py-2 text-xs font-medium text-ink-500 aria-pressed:bg-cream-50 aria-pressed:text-wine-700"
              >
                {mode === "day" ? "Día" : mode === "week" ? "Semana" : "Mes"}
              </button>
            ))}
          </div>
        </div>

        {view !== "day" && (
          <div className="grid grid-cols-7 border-b border-line pb-2 text-center text-xs font-medium text-ink-500">
            {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
          </div>
        )}
        {loadError ? (
          <div className="rounded-2xl bg-danger-50 p-5 text-center">
            <p role="alert" className="text-sm text-danger-700">No se pudo cargar la agenda compartida.</p>
            <Button type="button" variant="secondary" className="mt-3" onClick={retry}>Volver a intentar</Button>
          </div>
        ) : (
          <div className={view === "day" ? "grid grid-cols-1" : "grid grid-cols-7"}>
            {calendarDays.map((date) => {
              const dayActivities = activitiesByDate.get(date) ?? [];
              const dayAppointments = appointmentsByDate.get(date) ?? [];
              const inMonth = date.slice(0, 7) === selectedDate.slice(0, 7);
              const maxItems = view === "month" ? 2 : view === "day" ? 8 : 4;
              const count = dayActivities.length + dayAppointments.length;
              return (
                <div
                  key={date}
                  className={`min-h-24 border-b border-line/70 px-1.5 py-2 sm:min-h-28 sm:px-2 ${
                    view === "month" && !inMonth ? "opacity-45" : ""
                  } ${selectedDate === date ? "bg-blush-100/70" : ""} ${view === "day" ? "min-h-48 sm:min-h-64" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedDate(date)}
                    aria-label={dayLabel(date, { weekday: "long", day: "numeric", month: "long" })}
                    aria-pressed={selectedDate === date}
                    className={`mx-auto flex size-8 items-center justify-center rounded-full text-xs ${
                      date === today ? "bg-wine-600 font-semibold text-white" : "text-ink-700"
                    } ${selectedDate === date && date !== today ? "ring-1 ring-wine-500" : ""}`}
                  >
                    {Number(date.slice(-2))}
                  </button>
                  {view === "day" && <p className="mt-1 text-center text-xs capitalize text-ink-500">{dayLabel(date, { weekday: "long" })}</p>}
                  <div className="mt-1 flex flex-col gap-1">
                    {dayActivities.slice(0, maxItems).map((activity) => (
                      <ActivityChip
                        key={activity.id}
                        activity={activity}
                        userId={userId}
                        onClick={() => setActiveActivityId(activity.id)}
                      />
                    ))}
                    {dayAppointments.slice(0, Math.max(0, maxItems - dayActivities.length)).map((appointment) => (
                      <button
                        key={appointment.id}
                        type="button"
                        onClick={() => setActiveAppointmentId(appointment.id)}
                        title={`${formatTime(appointment.start_time)} · ${appointment.title}`}
                        className="truncate rounded-md border-l-2 border-wine-500 bg-blush-100 px-1.5 py-1 text-left text-[10px] leading-4 text-wine-700 sm:text-xs"
                      >
                        <span className="font-medium">{formatTime(appointment.start_time)}</span> · {appointment.title}
                      </button>
                    ))}
                    {count > maxItems && <span className="px-1 text-[10px] text-ink-500">+{count - maxItems} más</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {isLoading && !loadError && <p className="mt-3 text-center text-xs text-ink-500">Actualizando calendario…</p>}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-sm font-medium capitalize text-ink-700">
            {dayLabel(selectedDate, { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <Button type="button" variant="secondary" className="h-9 px-3 text-xs" onClick={() => setFormActivity({ date: selectedDate, activity: null })}>
            <Plus className="size-4" aria-hidden /> Añadir actividad
          </Button>
        </div>
        {selectedActivities.length + selectedAppointments.length > 0 ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {selectedActivities.map((activity) => (
              <button
                key={activity.id}
                type="button"
                onClick={() => setActiveActivityId(activity.id)}
                className="flex min-w-0 items-center gap-3 rounded-2xl border border-line bg-cream-100 p-3 text-left hover:bg-blush-100"
              >
                <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: activityColor(activity, userId) }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink-900">
                    {activity.visibility === "availability" && activity.owner_id !== userId ? "Ocupado" : activity.title}
                  </span>
                  <span className="block text-xs text-ink-500">
                    {formatTime(activity.start_time)}–{formatTime(activity.end_time)} · {activity.owner_id === userId ? "Tú" : partner?.name ?? "Pareja"}
                  </span>
                </span>
              </button>
            ))}
            {selectedAppointments.map((appointment) => (
              <button
                key={appointment.id}
                type="button"
                onClick={() => setActiveAppointmentId(appointment.id)}
                className="flex min-w-0 items-center gap-3 rounded-2xl border border-line bg-cream-100 p-3 text-left hover:bg-blush-100"
              >
                <Heart className="size-4 shrink-0 fill-current text-rose-500" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink-900">{appointment.title}</span>
                  <span className="block text-xs text-ink-500">{formatTime(appointment.start_time)} · Cita compartida</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink-500">Un buen día para organizar algo o guardar un momento para ustedes.</p>
        )}
      </Card>

      <Card>
        <CardHeader
          title={<span className="flex items-center gap-2"><Sparkles className="size-5 text-rose-500" aria-hidden /> Tiempo libre en común</span>}
          description={`Buscamos espacios de al menos ${MINIMUM_FREE_SLOT} minutos entre ${formatMinutes(AVAILABILITY_START)} y ${formatMinutes(AVAILABILITY_END)}. Las actividades privadas de tu pareja no se revelan ni se incluyen.`}
        />
        <div className="mb-4 flex gap-1 rounded-full bg-cream-100 p-1 sm:w-fit">
          {(["day", "week"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={availabilityView === mode}
              onClick={() => setAvailabilityView(mode)}
              className="rounded-full px-4 py-2 text-xs font-medium text-ink-500 aria-pressed:bg-cream-50 aria-pressed:text-wine-700"
            >
              {mode === "day" ? "Este día" : "Esta semana"}
            </button>
          ))}
        </div>
        {availabilityDays.map((date) => {
          const slots = findFreeSlots(date, busyBlocks);
          return (
            <div key={date} className="border-t border-line py-3 first:border-t-0 first:pt-0">
              <h3 className="mb-2 text-sm font-medium capitalize text-ink-800">
                {dayLabel(date, { weekday: "long", day: "numeric", month: "long" })}
              </h3>
              {slots.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {slots.map((slot) => (
                    <div key={`${date}-${slot.start}`} className="flex items-center gap-2 rounded-full bg-blush-100 px-3 py-2 text-xs text-wine-700">
                      <Clock3 className="size-3.5" aria-hidden />
                      <span>{slot.start}–{slot.end}</span>
                      <button
                        type="button"
                        onClick={() => openAppointment(date, slot.start)}
                        className="font-semibold underline underline-offset-2"
                      >
                        Crear plan
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-ink-500">No encontramos un espacio de una hora con los horarios visibles.</p>
              )}
            </div>
          );
        })}
        {availabilityDays.some((date) => findFreeSlots(date, busyBlocks).length > 0) && (
          <p className="mt-3 flex items-center gap-2 border-t border-line pt-4 font-display text-lg font-semibold text-wine-700">
            <Heart className="size-4 fill-current text-rose-500" aria-hidden /> ¡Tienen tiempo para ustedes! ❤️
          </p>
        )}
      </Card>

      <DayNotes date={selectedDate} userId={userId} />

      {formActivity && (
        <ActivityForm
          key={formActivity.activity?.id ?? `new-${formActivity.date}`}
          date={formActivity.date}
          activity={formActivity.activity}
          onClose={() => setFormActivity(null)}
          onSaved={(result) => {
            setMessage(result);
            void refreshCalendar().catch(() => setMessage({
              status: "error",
              message: "La actividad se guardó, pero no se pudo actualizar el calendario.",
            }));
          }}
        />
      )}
      {appointmentDraft && (
        <AppointmentForm
          key={`${appointmentDraft.date}-${appointmentDraft.startTime}`}
          coupleId={coupleId}
          date={appointmentDraft.date}
          initialStartTime={appointmentDraft.startTime}
          appointment={null}
          onClose={() => setAppointmentDraft(null)}
          onSaved={(result) => {
            setMessage(result);
            void refreshCalendar().catch(() => setMessage({
              status: "error",
              message: "La cita se guardó, pero no se pudo actualizar el calendario.",
            }));
          }}
        />
      )}
      {activeActivity && (
        <ActivityDetails
          activity={activeActivity}
          isOwner={activeActivity.owner_id === userId}
          ownerName={activeActivity.owner_id === userId ? "Tú" : partner?.name ?? "Tu pareja"}
          onClose={() => setActiveActivityId(null)}
          onEdit={() => {
            setFormActivity({ date: activeActivity.activity_date, activity: activeActivity });
            setActiveActivityId(null);
          }}
          onDelete={() => removeActivity(activeActivity)}
          pending={pending}
        />
      )}
      {activeAppointment && (
        <AppointmentDetails
          appointment={activeAppointment}
          onClose={() => setActiveAppointmentId(null)}
        />
      )}
    </div>
  );
}

function groupByDate<T>(items: T[], getDate: (item: T) => string) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const date = getDate(item);
    const group = map.get(date) ?? [];
    group.push(item);
    map.set(date, group);
  }
  return map;
}

function ActivityChip({
  activity,
  userId,
  onClick,
}: {
  activity: CalendarActivity;
  userId: string;
  onClick: () => void;
}) {
  const color = activityColor(activity, userId);
  const title = activity.visibility === "availability" && activity.owner_id !== userId
    ? "Ocupado"
    : activity.title ?? "Actividad";
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${formatTime(activity.start_time)} · ${title}`}
      className="truncate rounded-md border-l-2 px-1.5 py-1 text-left text-[10px] leading-4 sm:text-xs"
      style={{ borderLeftColor: color, backgroundColor: `${color}1A`, color }}
    >
      <span className="font-medium">{formatTime(activity.start_time)}</span> · {title}
    </button>
  );
}

function ActivityDetails({
  activity,
  isOwner,
  ownerName,
  onClose,
  onEdit,
  onDelete,
  pending,
}: {
  activity: CalendarActivity;
  isOwner: boolean;
  ownerName: string;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  pending: boolean;
}) {
  const isBusyOnly = !isOwner && activity.visibility === "availability";
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink-900/45 p-4"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section role="dialog" aria-modal="true" aria-labelledby="calendar-activity-title" className="w-full max-w-lg rounded-3xl border border-line bg-cream-50 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-wine-600">{isBusyOnly ? "Disponibilidad" : ACTIVITY_CATEGORIES[activity.category ?? ""] ?? "Actividad"} · {ownerName}</p>
            <h2 id="calendar-activity-title" className="mt-1 font-display text-2xl font-semibold text-wine-700">
              {isBusyOnly ? "Ocupado" : activity.title}
            </h2>
          </div>
          <Button type="button" variant="ghost" className="size-9 px-0" onClick={onClose} aria-label="Cerrar">
            <X className="size-5" aria-hidden />
          </Button>
        </div>
        <p className="mt-4 flex items-center gap-2 text-sm text-ink-700">
          <CalendarDays className="size-4 text-wine-600" aria-hidden />
          {dayLabel(activity.activity_date, { weekday: "long", day: "numeric", month: "long" })}
          · {formatTime(activity.start_time)}–{formatTime(activity.end_time)}
        </p>
        {isBusyOnly ? (
          <p className="mt-4 rounded-2xl bg-cream-100 p-4 text-sm text-ink-600">
            Tu pareja ha reservado este horario. Los detalles de la actividad son privados.
          </p>
        ) : (
          <>
            {activity.location && <p className="mt-3 flex items-center gap-2 text-sm text-ink-700"><MapPin className="size-4 text-wine-600" aria-hidden /> {activity.location}</p>}
            {activity.description && <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-ink-700">{activity.description}</p>}
            {isOwner && activity.personal_notes && (
              <p className="mt-4 rounded-2xl bg-blush-100 p-4 text-sm text-ink-700">
                <span className="mb-1 block font-medium">Notas privadas</span>
                {activity.personal_notes}
              </p>
            )}
          </>
        )}
        {isOwner && (
          <div className="mt-6 flex justify-end gap-2 border-t border-line pt-4">
            <Button type="button" variant="secondary" onClick={onEdit}>Editar</Button>
            <Button type="button" variant="danger" onClick={onDelete} disabled={pending}>
              <Trash2 className="size-4" aria-hidden /> Eliminar
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

function AppointmentDetails({ appointment, onClose }: { appointment: AppointmentWithCover; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink-900/45 p-4"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section role="dialog" aria-modal="true" aria-labelledby="shared-plan-title" className="w-full max-w-lg rounded-3xl border border-line bg-cream-50 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm text-rose-500"><Heart className="size-4 fill-current" aria-hidden /> {APPOINTMENT_CATEGORIES[appointment.category] ?? "Cita compartida"}</p>
            <h2 id="shared-plan-title" className="mt-1 font-display text-2xl font-semibold text-wine-700">{appointment.title}</h2>
          </div>
          <Button type="button" variant="ghost" className="size-9 px-0" onClick={onClose} aria-label="Cerrar">
            <X className="size-5" aria-hidden />
          </Button>
        </div>
        <p className="mt-4 flex items-center gap-2 text-sm text-ink-700">
          <CalendarDays className="size-4 text-wine-600" aria-hidden />
          {dayLabel(appointment.date, { weekday: "long", day: "numeric", month: "long" })}
          · {formatTime(appointment.start_time)}{appointment.end_time ? `–${formatTime(appointment.end_time)}` : ""}
        </p>
        {appointment.location && <p className="mt-3 flex items-center gap-2 text-sm text-ink-700"><MapPin className="size-4 text-wine-600" aria-hidden /> {appointment.location}</p>}
        {appointment.description && <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-ink-700">{appointment.description}</p>}
        {appointment.notes && <p className="mt-4 rounded-2xl bg-blush-100 p-4 text-sm text-ink-700">{appointment.notes}</p>}
        <div className="mt-6 flex justify-end border-t border-line pt-4">
          <ButtonLink href="/citas" variant="secondary">Gestionar cita</ButtonLink>
        </div>
      </section>
    </div>
  );
}
