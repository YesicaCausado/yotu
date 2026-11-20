"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Heart,
  MessageCircleHeart,
  Pause,
  Plus,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  addCoupleTalkMessage,
  deleteCoupleTalkDraft,
  markCoupleTalkRead,
  proposeCoupleTalkAgreement,
  respondToCoupleTalkAgreement,
  saveCoupleTalkEntry,
  setCoupleTalkPause,
  setCoupleTalkProgress,
  setCoupleTalkResolution,
} from "@/features/couple-talk/actions";
import { createClient } from "@/lib/supabase/client";
import type { FormState } from "@/lib/form";
import type {
  CoupleTalkAgreement,
  CoupleTalkEmotion,
  CoupleTalkMessage,
  CoupleTalkNeed,
  CoupleTalkNotification,
  CoupleTalkStatus,
  CoupleTalkThread,
} from "@/types/database";

const CATEGORY_LABELS = {
  argument: "Tuvimos una discusión",
  upset: "Algo me molestó",
  ignored: "Me siento ignorado/a",
  distant: "Me siento distante",
  disappointed: "Estoy decepcionado/a",
  important: "Necesito expresar algo importante",
  pending: "Tenemos un problema pendiente",
  other: "Otro",
} as const;
const EMOTIONS: { id: CoupleTalkEmotion; label: string; emoji: string }[] = [
  { id: "sadness", label: "Tristeza", emoji: "😢" },
  { id: "anger", label: "Enojo", emoji: "😠" },
  { id: "disappointment", label: "Decepción", emoji: "😞" },
  { id: "frustration", label: "Frustración", emoji: "😣" },
  { id: "anxiety", label: "Ansiedad", emoji: "😟" },
  { id: "hurt", label: "Dolor", emoji: "💔" },
  { id: "confusion", label: "Confusión", emoji: "😕" },
  { id: "loneliness", label: "Soledad", emoji: "🫂" },
  { id: "vulnerable", label: "Vulnerabilidad", emoji: "🥺" },
  { id: "affection", label: "Necesidad de cariño", emoji: "💗" },
  { id: "calm", label: "Tranquilidad", emoji: "😌" },
  { id: "exhausted", label: "Agotamiento", emoji: "😮‍💨" },
];
const NEEDS: { id: CoupleTalkNeed; label: string }[] = [
  { id: "listen", label: "Que me escuche sin juzgarme" },
  { id: "affection", label: "Un abrazo y cariño" },
  { id: "talk", label: "Que hablemos del problema" },
  { id: "apology", label: "Una disculpa" },
  { id: "love", label: "Que me demuestre amor" },
  { id: "space", label: "Necesito un poco de espacio" },
  { id: "agreement", label: "Que lleguemos a un acuerdo" },
  { id: "solution", label: "Que busquemos una solución juntos" },
  { id: "understand", label: "Que comprenda cómo me siento" },
  { id: "recognize", label: "Que reconozca lo que pasó" },
];
const EXPECTATIONS = {
  talk_now: "Quiero que hablemos ahora",
  before_sleep: "Quiero resolverlo antes de dormir",
  partner_initiative: "Quiero que mi pareja tome la iniciativa",
  time_to_think: "Necesito tiempo para pensar",
  reconcile: "Quiero que nos reconciliemos",
  express_only: "Por ahora solo quiero expresar lo que siento",
} as const;
const QUICK_REPLIES = {
  talk_solve: "Quiero hablar y solucionarlo.",
  affection: "Quiero darte cariño.",
  listen: "Quiero escucharte.",
  understand: "Entiendo cómo te sientes.",
  think: "Necesito un momento para pensar.",
} as const;
const STATUS_LABELS: Record<CoupleTalkStatus, string> = {
  draft: "Borrador privado",
  pending_read: "Pendiente de leer",
  read: "Leído",
  conversation: "En conversación",
  in_progress: "En proceso de solución",
  resolved: "Resuelto entre ambos",
};

type DraftForm = {
  id: string;
  requestKey: string;
  category: keyof typeof CATEGORY_LABELS;
  story: string;
  emotions: CoupleTalkEmotion[];
  needs: CoupleTalkNeed[];
  expectation: keyof typeof EXPECTATIONS;
  personalMessage: string;
};

function newDraft(): DraftForm {
  return {
    id: "",
    requestKey: crypto.randomUUID(),
    category: "important",
    story: "",
    emotions: [],
    needs: [],
    expectation: "talk_now",
    personalMessage: "",
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function uniqueKey() {
  return crypto.randomUUID();
}

export function CoupleTalkWorkspace({
  coupleId,
  userId,
  userName,
  partnerName,
  partnerLinked,
}: {
  coupleId: string;
  userId: string;
  userName: string;
  partnerName: string;
  partnerLinked: boolean;
}) {
  const [threads, setThreads] = useState<CoupleTalkThread[]>([]);
  const [notifications, setNotifications] = useState<CoupleTalkNotification[]>([]);
  const [messages, setMessages] = useState<CoupleTalkMessage[]>([]);
  const [agreements, setAgreements] = useState<CoupleTalkAgreement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [messageKey, setMessageKey] = useState(uniqueKey);
  const [statusFilter, setStatusFilter] = useState<CoupleTalkStatus | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const [threadResult, notificationResult] = await Promise.all([
      supabase.from("couple_talk_threads").select("*").eq("couple_id", coupleId).order("updated_at", { ascending: false }),
      supabase.from("couple_talk_notifications").select("*").eq("recipient_id", userId).is("seen_at", null).order("created_at", { ascending: false }).limit(50),
    ]);
    if (threadResult.error || notificationResult.error) throw new Error("No se pudieron cargar las conversaciones.");
    setThreads(threadResult.data ?? []);
    setNotifications(notificationResult.data ?? []);
    return threadResult.data ?? [];
  }, [coupleId, userId]);

  const loadThreadDetails = useCallback(async (threadId: string | null) => {
    if (!threadId) {
      setMessages([]);
      setAgreements([]);
      return;
    }
    const supabase = createClient();
    const [messageResult, agreementResult] = await Promise.all([
      supabase.from("couple_talk_messages").select("*").eq("thread_id", threadId).order("created_at"),
      supabase.from("couple_talk_agreements").select("*").eq("thread_id", threadId).order("created_at", { ascending: false }),
    ]);
    if (messageResult.error || agreementResult.error) throw new Error("No se pudo cargar el detalle de esta conversación.");
    setMessages(messageResult.data ?? []);
    setAgreements(agreementResult.data ?? []);
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve()
      .then(refresh)
      .then(async (items) => {
        if (!active) return;
        const selected = items.find((item) => item.id === selectedId);
        if (selected) await loadThreadDetails(selected.id);
      })
      .catch(() => { if (active) setErrorMessage("No se pudieron cargar las conversaciones. Comprueba tu conexión e inténtalo de nuevo."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh, loadThreadDetails, selectedId]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`couple-talk:${coupleId}:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "couple_talk_threads", filter: `couple_id=eq.${coupleId}` }, () => {
        void refresh().catch(() => setErrorMessage("No se pudo sincronizar. Actualiza la página para ver los cambios."));
        if (selectedId) void loadThreadDetails(selectedId).catch(() => setErrorMessage("No se pudo sincronizar la conversación."));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "couple_talk_messages", filter: `couple_id=eq.${coupleId}` }, () => {
        if (selectedId) void loadThreadDetails(selectedId).catch(() => setErrorMessage("No se pudo sincronizar la conversación."));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "couple_talk_agreements", filter: `couple_id=eq.${coupleId}` }, () => {
        if (selectedId) void loadThreadDetails(selectedId).catch(() => setErrorMessage("No se pudo sincronizar el acuerdo."));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "couple_talk_notifications", filter: `recipient_id=eq.${userId}` }, () => {
        void refresh().catch(() => setErrorMessage("No se pudieron actualizar los avisos."));
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [coupleId, userId, selectedId, refresh, loadThreadDetails]);

  const selectedThread = threads.find((thread) => thread.id === selectedId) ?? null;
  const filteredThreads = useMemo(() => threads.filter((thread) => {
    if (statusFilter !== "all" && thread.status !== statusFilter) return false;
    const date = thread.created_at.slice(0, 10);
    if (dateFrom && date < dateFrom) return false;
    if (dateTo && date > dateTo) return false;
    return true;
  }), [threads, statusFilter, dateFrom, dateTo]);

  async function perform(task: () => Promise<FormState>, afterSuccess?: () => Promise<void> | void) {
    setPending(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const state = await task();
      if (state.status === "error") {
        setErrorMessage(state.message ?? "No se pudo guardar el cambio.");
        return;
      }
      setSuccessMessage(state.message ?? "Cambios guardados.");
      await afterSuccess?.();
    } catch {
      setErrorMessage("No se pudo completar la acción. Comprueba tu conexión e inténtalo de nuevo.");
    } finally {
      setPending(false);
    }
  }

  async function selectThread(thread: CoupleTalkThread) {
    setSelectedId(thread.id);
    setDraft(null);
    setErrorMessage("");
    try {
      await loadThreadDetails(thread.id);
      if (thread.visibility === "shared") {
        const marked = await markCoupleTalkRead(thread.id);
        if (marked.status === "error") {
          setErrorMessage(marked.message ?? "No se pudo marcar la conversación como leída.");
          return;
        }
        const supabase = createClient();
        const { error } = await supabase.from("couple_talk_notifications").update({ seen_at: new Date().toISOString() })
          .eq("thread_id", thread.id).eq("recipient_id", userId).is("seen_at", null);
        if (error) {
          setErrorMessage("Se abrió la conversación, pero no se pudo actualizar su aviso.");
          return;
        }
        await refresh();
      }
    } catch {
      setErrorMessage("No se pudo abrir esta conversación. Inténtalo de nuevo.");
    }
  }

  function editDraft(thread: CoupleTalkThread) {
    setSelectedId(thread.id);
    setDraft({
      id: thread.id,
      requestKey: thread.request_key,
      category: thread.category,
      story: thread.story,
      emotions: thread.emotions,
      needs: thread.needs,
      expectation: thread.expectation,
      personalMessage: thread.personal_message ?? "",
    });
    setSuccessMessage("");
    setErrorMessage("");
  }

  async function submitEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const formData = new FormData(form);
    formData.set("action", submitter?.value ?? "draft");
    const action = formData.get("action") === "share" ? "share" : "draft";
    await perform(() => saveCoupleTalkEntry(formData), async () => {
      const items = await refresh();
      const saved = items.find((thread) => thread.request_key === draft?.requestKey && thread.created_by === userId);
      if (saved && action === "share") await selectThread(saved);
      if (saved && action === "draft") {
        setSelectedId(saved.id);
        setDraft((current) => current ? { ...current, id: saved.id } : null);
      }
    });
  }

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await perform(() => addCoupleTalkMessage(formData), async () => {
      setMessageKey(uniqueKey());
      await Promise.all([refresh(), loadThreadDetails(selectedId)]);
    });
  }

  async function deleteDraft(thread: CoupleTalkThread) {
    if (!window.confirm("¿Quieres eliminar este borrador privado? Esta acción no se puede deshacer.")) return;
    await perform(() => deleteCoupleTalkDraft(thread.id), async () => {
      setSelectedId(null);
      setDraft(null);
      await refresh();
    });
  }

  if (loading) return <p className="text-sm text-ink-500">Preparando un espacio para conversar…</p>;

  return (
    <div className="space-y-6">
      <header className="rounded-3xl bg-gradient-to-br from-blush-100 via-cream-50 to-cream-100 p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-cream-50 p-3 text-wine-600 shadow-soft"><MessageCircleHeart className="size-6" aria-hidden /></div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-wine-600">Un espacio seguro para los dos</p>
            <h1 className="mt-1 font-display text-3xl font-semibold text-wine-800">Hablemos <span aria-hidden>❤️</span></h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-600">
              Aquí pueden compartir lo que sienten, escucharse sin prisa y buscar acuerdos con cariño. No hay obligación de responder de inmediato.
            </p>
          </div>
        </div>
        {notifications.length > 0 && (
          <div className="mt-5 rounded-2xl border border-wine-500/10 bg-white/70 px-4 py-3 text-sm text-wine-700" role="status">
            Tienes {notifications.length} {notifications.length === 1 ? "aviso nuevo" : "avisos nuevos"} de Hablemos. Al abrir cada conversación se marcará como leído.
          </div>
        )}
      </header>

      {errorMessage && <Alert tone="error">{errorMessage}</Alert>}
      {successMessage && <Alert tone="success">{successMessage}</Alert>}

      <div className="grid gap-5 lg:grid-cols-[minmax(250px,0.8fr)_minmax(0,1.5fr)]">
        <Card className={selectedThread || draft ? "hidden lg:block" : ""}>
          <CardHeader
            title="Nuestro progreso"
            description="Conversaciones y acuerdos, sin comparaciones ni culpables."
            action={<Button type="button" className="size-10 !px-0" aria-label="Quiero expresar lo que siento" onClick={() => { setDraft(newDraft()); setSelectedId(null); setErrorMessage(""); setSuccessMessage(""); }}><Plus className="size-5" aria-hidden /></Button>}
          />
          <div className="mb-4 grid grid-cols-2 gap-2">
            <label className="text-xs font-medium text-ink-600">
              Estado
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as CoupleTalkStatus | "all")} className="mt-1 h-10 w-full rounded-xl border border-line bg-white px-3 text-sm">
                <option value="all">Todos</option>
                {Object.entries(STATUS_LABELS).filter(([id]) => id !== "draft").map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                <option value="draft">Borradores privados</option>
              </select>
            </label>
            <label className="text-xs font-medium text-ink-600">
              Desde
              <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-line bg-white px-3 text-sm" />
            </label>
            <label className="text-xs font-medium text-ink-600">
              Hasta
              <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-line bg-white px-3 text-sm" />
            </label>
            <button type="button" className="self-end pb-2 text-left text-xs font-medium text-wine-700 underline" onClick={() => { setDateFrom(""); setDateTo(""); setStatusFilter("all"); }}>Limpiar filtros</button>
          </div>

          {filteredThreads.length === 0 ? (
            <EmptyState
              icon={Heart}
              title={threads.length ? "No hay conversaciones con estos filtros" : "Un espacio para escucharse"}
              description={threads.length ? "Prueba con otra fecha o estado." : "Si algo te preocupa o necesitas compartir cómo te sientes, puedes empezar cuando quieras."}
              action={!threads.length ? <Button type="button" onClick={() => { setDraft(newDraft()); setSelectedId(null); }}>Quiero expresar lo que siento</Button> : undefined}
            />
          ) : (
            <ul className="space-y-2">
              {filteredThreads.map((thread) => {
                const unread = notifications.some((notice) => notice.thread_id === thread.id);
                return (
                  <li key={thread.id}>
                    <button
                      type="button"
                      onClick={() => thread.status === "draft" ? editDraft(thread) : void selectThread(thread)}
                      className={`w-full rounded-2xl border p-4 text-left transition-colors ${selectedId === thread.id ? "border-wine-400 bg-blush-50" : "border-line hover:bg-cream-100"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className="text-xs font-medium text-wine-600">{CATEGORY_LABELS[thread.category]}</span>
                          <p className="mt-1 line-clamp-2 text-sm font-medium text-ink-800">{thread.story}</p>
                          <p className="mt-2 text-xs text-ink-500">{formatDate(thread.created_at)}</p>
                        </div>
                        {unread && <span className="mt-1 size-2.5 shrink-0 rounded-full bg-wine-500" aria-label="Aviso sin leer" />}
                      </div>
                      <span className="mt-3 inline-flex rounded-full bg-cream-100 px-2.5 py-1 text-[0.7rem] text-ink-600">{STATUS_LABELS[thread.status]}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className={selectedThread || draft ? "" : "hidden lg:block"}>
          {draft ? (
            <EntryForm
              draft={draft}
              pending={pending}
              partnerLinked={partnerLinked}
              onBack={() => { setDraft(null); setSelectedId(null); }}
              onSubmit={submitEntry}
              onChange={setDraft}
              onDelete={selectedThread?.status === "draft" ? () => void deleteDraft(selectedThread) : undefined}
            />
          ) : selectedThread ? (
            <ThreadDetail
              thread={selectedThread}
              userId={userId}
              userName={userName}
              partnerName={partnerName}
              messages={messages}
              agreements={agreements}
              pending={pending}
              messageKey={messageKey}
              onBack={() => setSelectedId(null)}
              onMessageSubmit={submitMessage}
              onPause={(paused) => void perform(() => setCoupleTalkPause(selectedThread.id, paused), async () => { await refresh(); })}
              onProgress={() => void perform(() => setCoupleTalkProgress(selectedThread.id), async () => { await refresh(); })}
              onResolution={(ready) => void perform(() => setCoupleTalkResolution(selectedThread.id, ready), async () => { await refresh(); })}
              onProposeAgreement={(formData) => void perform(() => proposeCoupleTalkAgreement(formData), async () => { await loadThreadDetails(selectedThread.id); })}
              onAgreementResponse={(agreementId, accept) => void perform(() => respondToCoupleTalkAgreement(agreementId, accept), async () => { await loadThreadDetails(selectedThread.id); })}
            />
          ) : (
            <Card className="hidden min-h-72 items-center justify-center lg:flex">
              <EmptyState
                icon={MessageCircleHeart}
                title="Cada conversación empieza con escuchar"
                description="Elige un registro para continuar o comparte con cariño lo que estás sintiendo."
                action={<Button type="button" onClick={() => { setDraft(newDraft()); setSelectedId(null); }}>Quiero expresar lo que siento</Button>}
              />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function CheckChoices<T extends string>({
  name,
  values,
  choices,
  onChange,
}: {
  name: string;
  values: T[];
  choices: { id: T; label: string; emoji?: string }[];
  onChange: (values: T[]) => void;
}) {
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {choices.map((choice) => {
        const checked = values.includes(choice.id);
        return (
          <label key={choice.id} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors ${checked ? "border-wine-400 bg-blush-50 text-wine-800" : "border-line bg-white text-ink-700 hover:bg-cream-100"}`}>
            <input
              type="checkbox"
              name={name}
              value={choice.id}
              checked={checked}
              onChange={() => onChange(checked ? values.filter((value) => value !== choice.id) : [...values, choice.id])}
              className="accent-[#9e5368]"
            />
            {choice.emoji && <span aria-hidden>{choice.emoji}</span>}
            <span>{choice.label}</span>
          </label>
        );
      })}
    </div>
  );
}

function EntryForm({
  draft,
  pending,
  partnerLinked,
  onBack,
  onSubmit,
  onChange,
  onDelete,
}: {
  draft: DraftForm;
  pending: boolean;
  partnerLinked: boolean;
  onBack: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: (draft: DraftForm) => void;
  onDelete?: () => void;
}) {
  const update = <K extends keyof DraftForm>(key: K, value: DraftForm[K]) => onChange({ ...draft, [key]: value });
  return (
    <Card>
      <CardHeader
        title="Quiero expresar lo que siento"
        description="Escribe a tu ritmo. Un borrador solo lo puedes ver tú."
        action={<Button type="button" variant="ghost" className="size-10 !px-0 lg:hidden" aria-label="Volver a conversaciones" onClick={onBack}><ArrowLeft className="size-5" aria-hidden /></Button>}
      />
      <form onSubmit={onSubmit} className="space-y-6">
        <input type="hidden" name="threadId" value={draft.id} />
        <input type="hidden" name="requestKey" value={draft.requestKey} />
        <label className="block text-sm font-medium text-ink-700">
          ¿Qué está pasando?
          <select name="category" value={draft.category} onChange={(event) => update("category", event.target.value as DraftForm["category"])} className="mt-2 h-12 w-full rounded-2xl border border-line bg-white px-4">
            {Object.entries(CATEGORY_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium text-ink-700">
          Cuéntanos qué sucedió y cómo viviste la situación
          <textarea name="story" required minLength={1} maxLength={6000} value={draft.story} onChange={(event) => update("story", event.target.value)} rows={5} className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 font-normal leading-6" />
        </label>
        <fieldset>
          <legend className="text-sm font-medium text-ink-700">¿Cómo te sientes? <span className="text-ink-500">(elige una o varias)</span></legend>
          <CheckChoices name="emotions" values={draft.emotions} choices={EMOTIONS} onChange={(values) => update("emotions", values)} />
        </fieldset>
        <fieldset>
          <legend className="text-sm font-medium text-ink-700">¿Qué necesitas de tu pareja? <span className="text-ink-500">(elige una o varias)</span></legend>
          <CheckChoices name="needs" values={draft.needs} choices={NEEDS} onChange={(values) => update("needs", values)} />
        </fieldset>
        <label className="block text-sm font-medium text-ink-700">
          ¿Qué te gustaría que pasara ahora?
          <select name="expectation" value={draft.expectation} onChange={(event) => update("expectation", event.target.value as DraftForm["expectation"])} className="mt-2 h-12 w-full rounded-2xl border border-line bg-white px-4">
            {Object.entries(EXPECTATIONS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium text-ink-700">
          ¿Hay algo más que quieras decirle a tu pareja?
          <textarea name="personalMessage" maxLength={3000} value={draft.personalMessage} onChange={(event) => update("personalMessage", event.target.value)} rows={3} className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 font-normal" />
        </label>
        {!partnerLinked && <Alert tone="info">Puedes guardar este borrador privado. Para compartirlo, primero vincula a tu pareja desde la sección Pareja.</Alert>}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" name="action" value="draft" variant="secondary" pending={pending}>Guardar como borrador</Button>
          <Button type="submit" name="action" value="share" pending={pending} disabled={!partnerLinked}>Compartir con mi pareja</Button>
          {onDelete && <Button type="button" variant="danger" pending={pending} onClick={onDelete}><Trash2 className="size-4" aria-hidden />Eliminar borrador</Button>}
        </div>
      </form>
    </Card>
  );
}

function ThreadDetail({
  thread,
  userId,
  userName,
  partnerName,
  messages,
  agreements,
  pending,
  messageKey,
  onBack,
  onMessageSubmit,
  onPause,
  onProgress,
  onResolution,
  onProposeAgreement,
  onAgreementResponse,
}: {
  thread: CoupleTalkThread;
  userId: string;
  userName: string;
  partnerName: string;
  messages: CoupleTalkMessage[];
  agreements: CoupleTalkAgreement[];
  pending: boolean;
  messageKey: string;
  onBack: () => void;
  onMessageSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onPause: (paused: boolean) => void;
  onProgress: () => void;
  onResolution: (ready: boolean) => void;
  onProposeAgreement: (formData: FormData) => void;
  onAgreementResponse: (agreementId: string, accept: boolean) => void;
}) {
  const [agreementKey, setAgreementKey] = useState(uniqueKey);
  const [quickReply, setQuickReply] = useState<keyof typeof QUICK_REPLIES | "">("");
  const [messageBody, setMessageBody] = useState("");
  const myVote = thread.resolution_votes.includes(userId);
  const partnerHasVoted = thread.resolution_votes.some((id) => id !== userId);

  return (
    <Card>
      <CardHeader
        title={CATEGORY_LABELS[thread.category]}
        description={`${STATUS_LABELS[thread.status]} · ${formatDate(thread.created_at)}`}
        action={<Button type="button" variant="ghost" className="size-10 !px-0 lg:hidden" aria-label="Volver a conversaciones" onClick={onBack}><ArrowLeft className="size-5" aria-hidden /></Button>}
      />
      <div className="space-y-5">
        <div className="rounded-2xl bg-blush-50 p-4 sm:p-5">
          <p className="whitespace-pre-wrap text-sm leading-6 text-ink-800">{thread.story}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {thread.emotions.map((id) => {
              const emotion = EMOTIONS.find((item) => item.id === id);
              return <span key={id} className="rounded-full bg-white px-3 py-1 text-xs">{emotion?.emoji} {emotion?.label}</span>;
            })}
          </div>
          <p className="mt-4 text-xs font-medium uppercase tracking-wide text-wine-600">Lo que necesito</p>
          <ul className="mt-1 list-inside list-disc text-sm text-ink-700">
            {thread.needs.map((id) => <li key={id}>{NEEDS.find((item) => item.id === id)?.label}</li>)}
          </ul>
          <p className="mt-4 text-sm text-ink-700"><strong>Me gustaría:</strong> {EXPECTATIONS[thread.expectation]}</p>
          {thread.personal_message && <p className="mt-4 whitespace-pre-wrap border-t border-wine-500/10 pt-4 text-sm leading-6 text-ink-700">{thread.personal_message}</p>}
        </div>

        {thread.pause_requested_by && (
          <Alert tone="info">
            {thread.pause_requested_by === userId ? "Pediste una pausa para tomar aire. Puedes retomarla cuando quieras." : `${partnerName} pidió una pausa. Pueden retomar cuando ambos se sientan listos.`}
          </Alert>
        )}

        <div className="flex flex-wrap gap-2">
          {!thread.pause_requested_by
            ? <Button type="button" variant="secondary" pending={pending} onClick={() => onPause(true)}><Pause className="size-4" aria-hidden />Solicitar una pausa</Button>
            : <Button type="button" variant="secondary" pending={pending} onClick={() => onPause(false)}>Cerrar la pausa</Button>}
          {thread.status !== "resolved" && thread.status !== "in_progress" && <Button type="button" variant="secondary" pending={pending} onClick={onProgress}>Estamos buscando una solución</Button>}
          {thread.status !== "resolved" && (
            <Button type="button" variant={myVote ? "secondary" : "primary"} pending={pending} onClick={() => onResolution(!myVote)}>
              <CheckCheck className="size-4" aria-hidden />
              {myVote ? "Retirar mi confirmación" : "Confirmar que está resuelto"}
            </Button>
          )}
        </div>
        {thread.status === "in_progress" && <p className="text-sm text-ink-500">{myVote ? "Tu confirmación está guardada; falta la de tu pareja." : partnerHasVoted ? "Tu pareja ya confirmó. Puedes hacerlo cuando estés de acuerdo." : "El estado solo cambiará a resuelto cuando ambos confirmen."}</p>}

        <section>
          <h3 className="font-display text-xl font-semibold text-wine-700">Conversación privada</h3>
          {messages.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-line p-4 text-sm text-ink-500">Todavía no hay respuestas. Pueden tomarse el tiempo que necesiten.</p>
          ) : (
            <ol className="mt-3 space-y-3">
              {messages.map((message) => (
                <li key={message.id} className={`max-w-[92%] rounded-2xl p-4 ${message.author_id === userId ? "ml-auto bg-wine-600 text-white" : "bg-cream-100 text-ink-800"}`}>
                  <p className="mb-1 text-xs opacity-75">{message.author_id === userId ? userName : partnerName} · {formatDate(message.created_at)}</p>
                  {message.quick_reply && <p className="font-medium">{QUICK_REPLIES[message.quick_reply]}</p>}
                  {message.body && <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{message.body}</p>}
                </li>
              ))}
            </ol>
          )}
          <form onSubmit={onMessageSubmit} className="mt-4 space-y-3 rounded-2xl bg-cream-100 p-4">
            <input type="hidden" name="threadId" value={thread.id} />
            <input type="hidden" name="requestKey" value={messageKey} />
            <label className="block text-sm font-medium text-ink-700">
              Respuesta rápida
              <select name="quickReply" value={quickReply} onChange={(event) => setQuickReply(event.target.value as keyof typeof QUICK_REPLIES | "")} className="mt-1 h-11 w-full rounded-xl border border-line bg-white px-3">
                <option value="">Ninguna</option>
                {Object.entries(QUICK_REPLIES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium text-ink-700">
              Escribe también una respuesta personal
              <textarea name="body" value={messageBody} onChange={(event) => setMessageBody(event.target.value)} maxLength={3000} rows={3} className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 font-normal" />
            </label>
            <Button type="submit" pending={pending}><Send className="size-4" aria-hidden />Enviar con cariño</Button>
          </form>
        </section>

        {thread.status === "resolved" && (
          <section className="border-t border-line pt-5">
            <h3 className="font-display text-xl font-semibold text-wine-700">Acuerdos de pareja</h3>
            <p className="mt-1 text-sm text-ink-500">Los acuerdos se guardan cuando ambos los aceptan.</p>
            {agreements.length > 0 && (
              <ul className="mt-3 space-y-3">
                {agreements.map((agreement) => (
                  <li key={agreement.id} className="rounded-2xl border border-line bg-white p-4">
                    <p className="text-sm leading-6 text-ink-800">{agreement.description}</p>
                    <p className="mt-2 text-xs text-ink-500">{agreement.status === "accepted" ? "Aceptado por ambos" : agreement.status === "rejected" ? "No aceptado" : "Pendiente de respuesta"} · {formatDate(agreement.created_at)}</p>
                    {agreement.status === "pending" && agreement.proposed_by !== userId && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button type="button" pending={pending} onClick={() => onAgreementResponse(agreement.id, true)}><Check className="size-4" aria-hidden />Aceptar</Button>
                        <Button type="button" variant="secondary" pending={pending} onClick={() => onAgreementResponse(agreement.id, false)}>No aceptar</Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {!agreements.some((agreement) => agreement.status === "pending") && (
              <form className="mt-4 space-y-3" onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                onProposeAgreement(formData);
                setAgreementKey(uniqueKey());
              }}>
                <input type="hidden" name="threadId" value={thread.id} />
                <input type="hidden" name="requestKey" value={agreementKey} />
                <label className="block text-sm font-medium text-ink-700">
                  ¿Qué compromiso quieren compartir?
                  <textarea name="description" maxLength={2000} required rows={2} placeholder="Nos comprometemos a escucharnos sin interrumpirnos…" className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 font-normal" />
                </label>
                <Button type="submit" variant="secondary" pending={pending}><Sparkles className="size-4" aria-hidden />Proponer acuerdo</Button>
              </form>
            )}
          </section>
        )}
        <p className="flex items-start gap-2 border-t border-line pt-4 text-xs leading-5 text-ink-500"><Heart className="mt-0.5 size-4 shrink-0 text-wine-500" aria-hidden />Los sentimientos no son una competencia. Pueden conversar sin prisa y pedir una pausa cuando la necesiten.</p>
      </div>
    </Card>
  );
}
