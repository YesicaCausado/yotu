"use client";

import { createClient } from "@/lib/supabase/client";
import { getUser } from "@/lib/dal";
import { dbErrorMessage } from "@/lib/errors";
import { errorState, successState, validationError, type FormState } from "@/lib/form";
import {
  coupleTalkAgreementSchema,
  coupleTalkEntrySchema,
  coupleTalkMessageSchema,
} from "@/lib/validation";

const SESSION_EXPIRED = "Tu sesión ha caducado. Vuelve a iniciar sesión.";

function strings(formData: FormData, name: string) {
  return formData.getAll(name).filter((value): value is string => typeof value === "string");
}

export async function saveCoupleTalkEntry(formData: FormData): Promise<FormState> {
  if (!(await getUser())) return errorState(SESSION_EXPIRED);
  const parsed = coupleTalkEntrySchema.safeParse({
    threadId: formData.get("threadId") ?? "",
    requestKey: formData.get("requestKey"),
    action: formData.get("action"),
    category: formData.get("category"),
    story: formData.get("story"),
    emotions: strings(formData, "emotions"),
    needs: strings(formData, "needs"),
    expectation: formData.get("expectation"),
    personalMessage: formData.get("personalMessage") ?? "",
  });
  if (!parsed.success) return validationError(parsed.error);

  const { error } = await createClient().rpc("save_couple_talk_entry", {
    p_thread_id: parsed.data.threadId || null,
    p_request_key: parsed.data.requestKey,
    p_action: parsed.data.action,
    p_category: parsed.data.category,
    p_story: parsed.data.story,
    p_emotions: parsed.data.emotions,
    p_needs: parsed.data.needs,
    p_expectation: parsed.data.expectation,
    p_personal_message: parsed.data.personalMessage,
  });
  if (error) return errorState(dbErrorMessage(error));
  return successState(parsed.data.action === "share"
    ? "Lo compartiste con tu pareja. Pueden conversar cuando ambos estén listos."
    : "Borrador guardado solo para ti.");
}

export async function deleteCoupleTalkDraft(threadId: string): Promise<FormState> {
  if (!(await getUser())) return errorState(SESSION_EXPIRED);
  const { error } = await createClient().rpc("delete_couple_talk_draft", { p_thread_id: threadId });
  if (error) return errorState(dbErrorMessage(error));
  return successState("Borrador eliminado.");
}

export async function markCoupleTalkRead(threadId: string): Promise<FormState> {
  if (!(await getUser())) return errorState(SESSION_EXPIRED);
  const { error } = await createClient().rpc("mark_couple_talk_read", { p_thread_id: threadId });
  return error ? errorState(dbErrorMessage(error)) : successState("Conversación marcada como leída.");
}

export async function addCoupleTalkMessage(formData: FormData): Promise<FormState> {
  if (!(await getUser())) return errorState(SESSION_EXPIRED);
  const parsed = coupleTalkMessageSchema.safeParse({
    threadId: formData.get("threadId"),
    requestKey: formData.get("requestKey"),
    quickReply: formData.get("quickReply") ?? "",
    body: formData.get("body") ?? "",
    emotions: strings(formData, "emotions"),
    needs: strings(formData, "needs"),
  });
  if (!parsed.success) return validationError(parsed.error);

  const { error } = await createClient().rpc("add_couple_talk_message", {
    p_thread_id: parsed.data.threadId,
    p_request_key: parsed.data.requestKey,
    p_quick_reply: parsed.data.quickReply || null,
    p_body: parsed.data.body,
    p_emotions: parsed.data.emotions,
    p_needs: parsed.data.needs,
  });
  return error ? errorState(dbErrorMessage(error)) : successState("Tu respuesta quedó en la conversación.");
}

export async function setCoupleTalkProgress(threadId: string): Promise<FormState> {
  if (!(await getUser())) return errorState(SESSION_EXPIRED);
  const { error } = await createClient().rpc("set_couple_talk_progress", { p_thread_id: threadId });
  return error ? errorState(dbErrorMessage(error)) : successState("Actualizamos el estado de la conversación.");
}

export async function setCoupleTalkPause(threadId: string, paused: boolean): Promise<FormState> {
  if (!(await getUser())) return errorState(SESSION_EXPIRED);
  const { error } = await createClient().rpc("set_couple_talk_pause", { p_thread_id: threadId, p_paused: paused });
  return error
    ? errorState(dbErrorMessage(error))
    : successState(paused ? "Tu pareja recibirá una solicitud de pausa, sin presión para responder." : "La pausa quedó cerrada.");
}

export async function setCoupleTalkResolution(threadId: string, ready: boolean): Promise<FormState> {
  if (!(await getUser())) return errorState(SESSION_EXPIRED);
  const { data, error } = await createClient().rpc("set_couple_talk_resolution", {
    p_thread_id: threadId,
    p_ready: ready,
  });
  return error
    ? errorState(dbErrorMessage(error))
    : successState(data === "resolved"
      ? "Ambos confirmaron que la situación está resuelta."
      : "Guardamos tu respuesta. El estado solo será resuelto cuando ambos estén de acuerdo.");
}

export async function proposeCoupleTalkAgreement(formData: FormData): Promise<FormState> {
  if (!(await getUser())) return errorState(SESSION_EXPIRED);
  const parsed = coupleTalkAgreementSchema.safeParse({
    threadId: formData.get("threadId"),
    requestKey: formData.get("requestKey"),
    description: formData.get("description"),
  });
  if (!parsed.success) return validationError(parsed.error);
  const { error } = await createClient().rpc("propose_couple_talk_agreement", {
    p_thread_id: parsed.data.threadId,
    p_request_key: parsed.data.requestKey,
    p_description: parsed.data.description,
  });
  return error ? errorState(dbErrorMessage(error)) : successState("Acuerdo propuesto. Se confirmará cuando tu pareja lo acepte.");
}

export async function respondToCoupleTalkAgreement(agreementId: string, accept: boolean): Promise<FormState> {
  if (!(await getUser())) return errorState(SESSION_EXPIRED);
  const { error } = await createClient().rpc("respond_to_couple_talk_agreement", {
    p_agreement_id: agreementId,
    p_accept: accept,
  });
  return error
    ? errorState(dbErrorMessage(error))
    : successState(accept ? "Acuerdo aceptado por ambos." : "Acuerdo rechazado; no se guardó como compromiso.");
}
