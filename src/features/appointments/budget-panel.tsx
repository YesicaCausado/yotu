"use client";

import { useCallback, useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { Bell, HeartHandshake, Plus, Receipt, Scale } from "lucide-react";
import { addAppointmentExpense, createBudgetProposal, respondToBudgetProposal } from "@/features/appointments/actions";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/alert";
import { Card, CardHeader } from "@/components/ui/card";
import type { AppointmentWithCover } from "@/lib/dal";
import type {
  BudgetNotificationType,
  Database,
} from "@/types/database";
import type { FormState } from "@/lib/form";

type Proposal = Database["public"]["Tables"]["appointment_budget_proposals"]["Row"];
type Agreement = Database["public"]["Tables"]["appointment_budget_agreements"]["Row"];
type Expense = Database["public"]["Tables"]["appointment_expenses"]["Row"];
type BudgetNotification = Database["public"]["Tables"]["appointment_budget_notifications"]["Row"];

const MODE_LABELS: Record<AppointmentWithCover["budget_mode"], string> = {
  invites: "Yo invito",
  accepts_contributions: "Acepto aportes",
  split: "Dividimos los gastos",
  shared_budget: "Presupuesto compartido",
};

const EVENT_LABELS: Record<BudgetNotificationType, string> = {
  proposal_received: "Recibiste una propuesta de aporte.",
  proposal_accepted: "Aceptaron tu propuesta.",
  proposal_rejected: "Rechazaron una propuesta. No se generó ningún compromiso.",
  counteroffer_received: "Recibiste una contraoferta.",
  agreement_confirmed: "El acuerdo económico fue confirmado por ambos.",
  budget_updated: "Se actualizó el presupuesto estimado.",
};

function cop(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function statusLabel(status: Proposal["status"]) {
  if (status === "pending") return "Pendiente";
  if (status === "accepted") return "Aceptada";
  if (status === "rejected") return "Rechazada";
  return "Respondida con contraoferta";
}

function formatLocalDateTime(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function BudgetPanel({
  appointment,
  userId,
  partner,
}: {
  appointment: AppointmentWithCover;
  userId: string;
  partner: { id: string; name: string } | null;
}) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [notifications, setNotifications] = useState<BudgetNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [message, setMessage] = useState<FormState | null>(null);
  const [pending, startTransition] = useTransition();
  const proposalRequestKey = useRef<string | null>(null);
  const expenseRequestKey = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const [proposalResult, agreementResult, expenseResult, notificationResult] = await Promise.all([
      supabase.from("appointment_budget_proposals").select("*").eq("appointment_id", appointment.id).order("created_at", { ascending: false }),
      supabase.from("appointment_budget_agreements").select("*").eq("appointment_id", appointment.id).maybeSingle(),
      supabase.from("appointment_expenses").select("*").eq("appointment_id", appointment.id).order("created_at", { ascending: false }),
      supabase.from("appointment_budget_notifications").select("*").eq("appointment_id", appointment.id).order("created_at", { ascending: false }).limit(12),
    ]);
    if (proposalResult.error || agreementResult.error || expenseResult.error || notificationResult.error) {
      throw new Error("No se pudo cargar la información del presupuesto.");
    }
    setProposals(proposalResult.data ?? []);
    setAgreement(agreementResult.data);
    setExpenses(expenseResult.data ?? []);
    setNotifications(notificationResult.data ?? []);
    setLoadError(false);
    setLoading(false);
  }, [appointment.id]);

  useEffect(() => {
    let active = true;
    const safeRefresh = () => {
      void refresh().catch(() => {
        if (active) {
          setLoadError(true);
          setLoading(false);
        }
      });
    };
    const supabase = createClient();
    const channel = supabase
      .channel(`appointment-budget:${appointment.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "appointment_budget_proposals", filter: `appointment_id=eq.${appointment.id}` }, safeRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "appointment_budget_agreements", filter: `appointment_id=eq.${appointment.id}` }, safeRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "appointment_expenses", filter: `appointment_id=eq.${appointment.id}` }, safeRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "appointment_budget_notifications", filter: `appointment_id=eq.${appointment.id}` }, safeRefresh)
      .subscribe();
    safeRefresh();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [appointment.id, refresh]);

  const totalSpent = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const totalOrganized = agreement ? Number(agreement.total_amount) : 0;
  const remaining = appointment.budget === null ? null : Number(appointment.budget) - totalOrganized;
  const pendingProposal = proposals.find((proposal) => proposal.status === "pending");
  const estimatedBudget = Number(appointment.budget ?? 0);
  const suggestedOwnAmount =
    appointment.budget_mode === "split" || appointment.budget_mode === "shared_budget"
      ? Math.floor(estimatedBudget / 2)
      : userId === appointment.created_by
        ? estimatedBudget
        : 0;
  const suggestedPartnerAmount =
    appointment.budget_mode === "split" || appointment.budget_mode === "shared_budget"
      ? Math.ceil(estimatedBudget / 2)
      : userId === appointment.created_by
        ? 0
        : estimatedBudget;

  function memberName(id: string) {
    return id === userId ? "Tú" : partner?.name ?? "Tu pareja";
  }

  function submitProposal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const formData = new FormData(event.currentTarget);
    formData.set("appointmentId", appointment.id);
    proposalRequestKey.current ??= crypto.randomUUID();
    formData.set("requestKey", proposalRequestKey.current);
    setMessage(null);
    startTransition(async () => {
      let result: FormState;
      try {
        result = await createBudgetProposal(formData);
      } catch {
        setMessage({ status: "error", message: "No se pudo confirmar si la propuesta se envió. Revisa el historial antes de volver a intentarlo." });
        return;
      }
      setMessage(result);
      if (result.status === "success") {
        proposalRequestKey.current = null;
        try {
          await refresh();
        } catch {
          setMessage({ status: "error", message: "La propuesta se envió, pero no se pudo actualizar el panel. Vuelve a cargarlo." });
        }
      }
    });
  }

  function submitResponse(proposal: Proposal, action: "accept" | "reject" | "counter", form?: HTMLFormElement) {
    if (pending) return;
    const formData = form ? new FormData(form) : new FormData();
    formData.set("proposalId", proposal.id);
    formData.set("action", action);
    if (action === "counter") formData.set("requestKey", crypto.randomUUID());
    setMessage(null);
    startTransition(async () => {
      let result: FormState;
      try {
        result = await respondToBudgetProposal(formData);
      } catch {
        setMessage({ status: "error", message: "No se pudo confirmar la respuesta. Revisa el estado de la propuesta antes de volver a intentarlo." });
        return;
      }
      setMessage(result);
      if (result.status === "success") {
        try {
          await refresh();
        } catch {
          setMessage({ status: "error", message: "La respuesta quedó guardada, pero no se pudo actualizar el panel." });
        }
      }
    });
  }

  function submitExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("appointmentId", appointment.id);
    expenseRequestKey.current ??= crypto.randomUUID();
    formData.set("requestKey", expenseRequestKey.current);
    setMessage(null);
    startTransition(async () => {
      let result: FormState;
      try {
        result = await addAppointmentExpense(formData);
      } catch {
        setMessage({ status: "error", message: "No se pudo confirmar si el gasto se registró. Revisa la lista antes de volver a intentarlo." });
        return;
      }
      setMessage(result);
      if (result.status === "success") {
        expenseRequestKey.current = null;
        form.reset();
        try {
          await refresh();
        } catch {
          setMessage({ status: "error", message: "El gasto se registró, pero no se pudo actualizar el resumen." });
        }
      }
    });
  }

  async function markSeen(notification: BudgetNotification) {
    try {
      const { error } = await createClient()
        .from("appointment_budget_notifications")
        .update({ seen_at: new Date().toISOString() })
        .eq("id", notification.id)
        .eq("recipient_id", userId);
      if (error) throw error;
      await refresh();
    } catch {
      setMessage({ status: "error", message: "No se pudo marcar la notificación como vista." });
    }
  }

  if (loading) return <p className="text-sm text-ink-500">Cargando el presupuesto compartido…</p>;

  return (
    <div className="mt-5 flex flex-col gap-4 border-t border-line pt-5">
      <Card className="bg-cream-100">
        <CardHeader
          title={<span className="flex items-center gap-2"><Scale className="size-5 text-wine-600" aria-hidden /> Nuestro presupuesto</span>}
          description={`${MODE_LABELS[appointment.budget_mode]} · Pesos colombianos (COP). Los aportes son voluntarios; no se mueve dinero ni se crean deudas.`}
        />
        {appointment.budget !== null && <p className="text-sm text-ink-700">Presupuesto estimado: <strong>{cop(Number(appointment.budget))}</strong></p>}
        {agreement ? (
          <div className="mt-3 grid gap-2 rounded-2xl bg-cream-50 p-4 text-sm sm:grid-cols-2">
            <p>{memberName(agreement.first_user_id)}: <strong>{cop(Number(agreement.first_amount))}</strong></p>
            <p>{memberName(agreement.second_user_id)}: <strong>{cop(Number(agreement.second_amount))}</strong></p>
            <p className="sm:col-span-2">Total organizado: <strong>{cop(totalOrganized)}</strong></p>
            {remaining !== null && (
              <p className="sm:col-span-2">
                {remaining >= 0 ? "Por organizar" : "Organizado por encima del estimado"}: <strong>{cop(Math.abs(remaining))}</strong>
              </p>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-ink-500">Todavía no hay un reparto acordado. Cualquier monto solo se confirma cuando ambos aceptan una propuesta.</p>
        )}
      </Card>

      {message && <FormMessage state={message} />}
      {loadError && <p role="alert" className="text-sm text-danger-700">No se pudo actualizar este presupuesto. <button type="button" className="underline" onClick={() => void refresh().catch(() => setLoadError(true))}>Reintentar</button></p>}

      <Card>
        <CardHeader title="Propuestas y acuerdos" description="Las propuestas aceptadas actualizan el acuerdo; el historial se conserva." />
        {pendingProposal && (
          <div className="mb-4 rounded-2xl border border-blush-200 bg-blush-100 p-4">
            <p className="text-sm font-semibold text-wine-700">
              {memberName(pendingProposal.proposer_id)} propone: {cop(Number(pendingProposal.proposer_amount))} · {memberName(pendingProposal.recipient_id)}: {cop(Number(pendingProposal.recipient_amount))}
            </p>
            {pendingProposal.message && <p className="mt-1 whitespace-pre-wrap text-sm text-ink-600">{pendingProposal.message}</p>}
            {pendingProposal.recipient_id === userId ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" className="h-9 px-3 text-xs" pending={pending} onClick={() => submitResponse(pendingProposal, "accept")}>Aceptar</Button>
                <Button type="button" variant="secondary" className="h-9 px-3 text-xs" pending={pending} onClick={() => submitResponse(pendingProposal, "reject")}>Rechazar</Button>
              </div>
            ) : <p className="mt-2 text-xs text-ink-500">Esperando respuesta; el acuerdo actual no cambia todavía.</p>}
            {pendingProposal.recipient_id === userId && (
              <form
                className="mt-3 grid gap-2 rounded-xl bg-cream-50 p-3 sm:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  submitResponse(pendingProposal, "counter", event.currentTarget);
                }}
              >
                <p className="text-xs font-medium text-ink-700 sm:col-span-2">O envía una contraoferta</p>
                <label className="text-xs text-ink-600">Tu aporte (COP)
                  <input name="proposerAmount" type="number" min="0" max="9999999999" step="1" defaultValue={pendingProposal.recipient_amount} required className={inputClass} />
                </label>
                <label className="text-xs text-ink-600">Aporte de tu pareja (COP)
                  <input name="recipientAmount" type="number" min="0" max="9999999999" step="1" defaultValue={pendingProposal.proposer_amount} required className={inputClass} />
                </label>
                <label className="text-xs text-ink-600 sm:col-span-2">Mensaje opcional
                  <input name="message" maxLength={500} className={inputClass} />
                </label>
                <div className="sm:col-span-2"><Button type="submit" variant="secondary" pending={pending}><HeartHandshake className="size-4" aria-hidden /> Enviar contraoferta</Button></div>
              </form>
            )}
          </div>
        )}

        <form onSubmit={submitProposal} className="grid gap-3 rounded-2xl border border-line p-4 sm:grid-cols-2">
          <p className="text-sm font-medium text-ink-700 sm:col-span-2">{pendingProposal ? "La propuesta actual debe resolverse antes de enviar otra." : "Proponer un reparto voluntario"}</p>
          <label className="text-xs text-ink-600">Tu aporte propuesto (COP)
            <input name="proposerAmount" type="number" min="0" max="9999999999" step="1" required defaultValue={suggestedOwnAmount} className={inputClass} />
          </label>
          <label className="text-xs text-ink-600">Aporte propuesto de tu pareja (COP)
            <input name="recipientAmount" type="number" min="0" max="9999999999" step="1" required defaultValue={suggestedPartnerAmount} className={inputClass} />
          </label>
          <label className="text-xs text-ink-600 sm:col-span-2">Mensaje opcional
            <textarea name="message" maxLength={500} rows={2} placeholder="Por ejemplo: solo si te queda cómodo ❤️" className={`${inputClass} h-auto py-2`} />
          </label>
          <div className="sm:col-span-2">
            <Button type="submit" variant="secondary" pending={pending} disabled={Boolean(pendingProposal) || !partner}>
              <Plus className="size-4" aria-hidden /> Enviar propuesta
            </Button>
          </div>
          {!partner && <p className="text-xs text-ink-500 sm:col-span-2">Cuando tu pareja se vincule a este espacio podrán proponer aportes.</p>}
        </form>

        {proposals.length > 0 ? (
          <ol className="mt-4 divide-y divide-line">
            {proposals.map((proposal) => (
              <li key={proposal.id} className="py-3 text-sm first:pt-0">
                <div className="flex flex-wrap justify-between gap-2">
                  <strong className="text-ink-800">{memberName(proposal.proposer_id)}: {cop(Number(proposal.proposer_amount))} · {memberName(proposal.recipient_id)}: {cop(Number(proposal.recipient_amount))}</strong>
                  <span className="text-xs text-ink-500">{statusLabel(proposal.status)}</span>
                </div>
                <p className="mt-1 text-xs text-ink-500">{formatLocalDateTime(proposal.created_at)}</p>
              </li>
            ))}
          </ol>
        ) : <p className="mt-4 text-sm text-ink-500">Pueden iniciar una conversación con una propuesta flexible.</p>}
      </Card>

      <Card>
        <CardHeader
          title={<span className="flex items-center gap-2"><Receipt className="size-5 text-wine-600" aria-hidden /> Gastos reales</span>}
          description={`Total registrado: ${cop(totalSpent)}. Se compara con el presupuesto estimado; no genera cobros ni deudas.`}
        />
        {expenses.length > 0 && (
          <ul className="mb-4 divide-y divide-line">
            {expenses.map((expense) => (
              <li key={expense.id} className="py-2 text-sm">
                <div className="flex justify-between gap-3"><span className="font-medium text-ink-800">{expense.concept}</span><strong>{cop(Number(expense.amount))}</strong></div>
                <p className="text-xs text-ink-500">Pagó {memberName(expense.paid_by)} · Lo asumió {memberName(expense.covered_by)}</p>
              </li>
            ))}
          </ul>
        )}
        {appointment.budget !== null && (
          <p className="mb-3 text-xs text-ink-500">
            {totalSpent <= Number(appointment.budget)
              ? `Quedan ${cop(Number(appointment.budget) - totalSpent)} del estimado.`
              : `Los gastos superan el estimado por ${cop(totalSpent - Number(appointment.budget))}.`}
          </p>
        )}
        <form onSubmit={submitExpense} className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
          <label className="text-xs text-ink-600">Concepto
            <input name="concept" maxLength={120} required placeholder="Cena, transporte…" className={inputClass} />
          </label>
          <label className="text-xs text-ink-600">Valor (COP)
            <input name="amount" type="number" min="1" max="9999999999" step="1" required className={inputClass} />
          </label>
          <label className="text-xs text-ink-600">¿Quién pagó?
            <select name="paidBy" defaultValue={userId} className={inputClass}>
              <option value={userId}>Tú</option>{partner && <option value={partner.id}>{partner.name}</option>}
            </select>
          </label>
          <label className="text-xs text-ink-600">¿Quién asumió el gasto?
            <select name="coveredBy" defaultValue={userId} className={inputClass}>
              <option value={userId}>Tú</option>{partner && <option value={partner.id}>{partner.name}</option>}
            </select>
          </label>
          <div className="sm:col-span-2"><Button type="submit" variant="secondary" pending={pending}>Registrar gasto</Button></div>
        </form>
      </Card>

      <Card>
        <CardHeader title={<span className="flex items-center gap-2"><Bell className="size-5 text-wine-600" aria-hidden /> Avisos de presupuesto</span>} description="Avisos dentro de la aplicación; nunca se envían ni mueven fondos." />
        {notifications.length === 0 ? <p className="text-sm text-ink-500">Aquí aparecerán las propuestas y cambios del presupuesto.</p> : (
          <ul className="divide-y divide-line">
            {notifications.map((notification) => (
              <li key={notification.id} className="flex items-start justify-between gap-3 py-2 first:pt-0">
                <span className={`text-sm ${notification.seen_at ? "text-ink-500" : "font-medium text-wine-700"}`}>
                  {EVENT_LABELS[notification.event_type]}
                  <span className="mt-1 block text-xs text-ink-500">{formatLocalDateTime(notification.created_at)}</span>
                </span>
                {!notification.seen_at && notification.recipient_id === userId && (
                  <button type="button" onClick={() => void markSeen(notification)} className="shrink-0 text-xs text-wine-700 underline">Marcar vista</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

const inputClass = "mt-1 h-10 w-full rounded-xl border border-line bg-cream-50 px-3 text-sm text-ink-900 focus:border-wine-500 focus:outline-none focus:ring-2 focus:ring-blush-200";
