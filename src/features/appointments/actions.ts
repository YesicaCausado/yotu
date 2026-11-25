"use client";

import { createClient } from "@/lib/supabase/client";
import { getUser } from "@/lib/dal";
import { dbErrorMessage, GENERIC_ERROR } from "@/lib/errors";
import { errorState, successState, validationError, type FormState } from "@/lib/form";
import {
  appointmentExpenseSchema,
  appointmentSchema,
  budgetProposalSchema,
  budgetResponseSchema,
  surpriseAppointmentSchema,
} from "@/lib/validation";
import { dateTimeLocalToIso } from "@/lib/dates";

const SESSION_EXPIRED = "Tu sesión ha caducado. Vuelve a iniciar sesión.";

async function getCurrentCoupleId() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("current_couple_id");
  if (error) return { supabase, coupleId: null, error };
  return { supabase, coupleId: data, error: null };
}

async function removeCover(supabase: Awaited<ReturnType<typeof createClient>>, path: string) {
  try {
    const { error } = await supabase.storage.from("appointment-covers").remove([path]);
    return !error;
  } catch {
    return false;
  }
}

function isCoverPath(path: string, coupleId: string) {
  return new RegExp(`^${coupleId}/appointment-cover-[0-9a-f-]{36}\\.(jpg|png|webp)$`).test(path);
}

export async function saveAppointment(formData: FormData): Promise<FormState> {
  if (!(await getUser())) return errorState(SESSION_EXPIRED);

  const parsed = appointmentSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    date: formData.get("date"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime") ?? "",
    location: formData.get("location") ?? "",
    category: formData.get("category"),
    budget: formData.get("budget") ?? "",
    budgetMode: formData.get("budgetMode") ?? "invites",
    budgetCurrency: formData.get("budgetCurrency") ?? "COP",
    notes: formData.get("notes") ?? "",
    status: formData.get("status") ?? "planned",
    appointmentId: formData.get("appointmentId") ?? "",
    requestKey: formData.get("requestKey"),
    imagePath: formData.get("imagePath") ?? "",
  });
  if (!parsed.success) return validationError(parsed.error);

  const { supabase, coupleId, error: coupleError } = await getCurrentCoupleId();
  if (coupleError) return errorState(dbErrorMessage(coupleError));
  if (!coupleId) return errorState(dbErrorMessage({ message: "not_in_couple" }));
  if (parsed.data.imagePath && !isCoverPath(parsed.data.imagePath, coupleId)) {
    return errorState(GENERIC_ERROR);
  }

  const appointment = {
    title: parsed.data.title,
    description: parsed.data.description,
    date: parsed.data.date,
    start_time: parsed.data.startTime,
    end_time: parsed.data.endTime,
    location: parsed.data.location,
    category: parsed.data.category,
    image_path: parsed.data.imagePath || null,
    budget: parsed.data.budget,
    budget_mode: parsed.data.budgetMode,
    budget_currency: parsed.data.budgetCurrency,
    notes: parsed.data.notes,
    status: parsed.data.appointmentId ? parsed.data.status : "planned",
  };

  if (parsed.data.appointmentId) {
    const { data: current, error: readError } = await supabase
      .from("appointments")
      .select("image_path")
      .eq("id", parsed.data.appointmentId)
      .eq("couple_id", coupleId)
      .maybeSingle();
    if (readError) return errorState(GENERIC_ERROR);
    if (!current) return errorState("No encontramos esa cita en vuestro espacio.");

    const { data: updated, error } = await supabase
      .from("appointments")
      .update(appointment)
      .eq("id", parsed.data.appointmentId)
      .eq("couple_id", coupleId)
      .select("id")
      .maybeSingle();
    if (error) return errorState(dbErrorMessage(error));
    if (!updated) return errorState("No se pudo actualizar la cita.");

    let message = "Cita actualizada para los dos.";
    if (current.image_path && current.image_path !== appointment.image_path) {
      if (!(await removeCover(supabase, current.image_path))) message += " No se pudo eliminar la portada anterior.";
    }
    return successState(message);
  }

  const { data: existing, error: duplicateReadError } = await supabase
    .from("appointments")
    .select("id")
    .eq("couple_id", coupleId)
    .eq("request_key", parsed.data.requestKey)
    .maybeSingle();
  if (duplicateReadError) return errorState(GENERIC_ERROR);
  if (existing) return successState("Esta cita ya se había guardado.");

  const { error } = await supabase.from("appointments").insert({
    couple_id: coupleId,
    request_key: parsed.data.requestKey,
    ...appointment,
  });
  if (error) {
    if (error.code === "23505") return successState("Esta cita ya se había guardado.");
    return errorState(dbErrorMessage(error));
  }

  return successState("¡Una nueva aventura está por comenzar!");
}

export async function saveSurpriseAppointment(formData: FormData): Promise<FormState> {
  const user = await getUser();
  if (!user) return errorState(SESSION_EXPIRED);
  const parsed = surpriseAppointmentSchema.safeParse({
    appointmentId: formData.get("appointmentId") ?? "",
    requestKey: formData.get("requestKey"),
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    date: formData.get("date"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime") ?? "",
    revealAt: formData.get("revealAt"),
    location: formData.get("location") ?? "",
    category: formData.get("category"),
    notes: formData.get("notes") ?? "",
    imagePath: formData.get("imagePath") ?? "",
  });
  if (!parsed.success) return validationError(parsed.error);

  const { supabase, coupleId, error: coupleError } = await getCurrentCoupleId();
  if (coupleError) return errorState(dbErrorMessage(coupleError));
  if (!coupleId) return errorState(dbErrorMessage({ message: "not_in_couple" }));
  const { data: couple, error: timezoneError } = await supabase
    .from("couples")
    .select("timezone")
    .eq("id", coupleId)
    .maybeSingle();
  if (timezoneError) return errorState(dbErrorMessage(timezoneError));
  if (!couple) return errorState("No encontramos vuestro espacio de pareja.");

  const imagePattern = new RegExp(
    `^${coupleId}/${user.id}/surprise-cover-[0-9a-f-]{36}\\.(jpg|png|webp)$`,
  );
  if (parsed.data.imagePath && !imagePattern.test(parsed.data.imagePath)) {
    return errorState(GENERIC_ERROR);
  }

  let revealAt: string;
  try {
    revealAt = dateTimeLocalToIso(parsed.data.revealAt, couple.timezone);
  } catch (error) {
    return errorState(error instanceof RangeError ? error.message : GENERIC_ERROR);
  }

  let previousImagePath: string | null = null;
  if (parsed.data.appointmentId) {
    const { data, error } = await supabase
      .from("appointment_surprise_details")
      .select("image_path")
      .eq("appointment_id", parsed.data.appointmentId)
      .maybeSingle();
    if (error) return errorState(dbErrorMessage(error));
    if (!data) return errorState("No encontramos esa sorpresa o ya se reveló.");
    previousImagePath = data.image_path;
  }

  const { error } = await supabase.rpc("create_or_update_surprise_appointment", {
    p_appointment_id: parsed.data.appointmentId || null,
    p_request_key: parsed.data.requestKey,
    p_title: parsed.data.title,
    p_description: parsed.data.description,
    p_appointment_date: parsed.data.date,
    p_appointment_start_time: parsed.data.startTime,
    p_appointment_end_time: parsed.data.endTime,
    p_reveal_at: revealAt,
    p_location: parsed.data.location,
    p_category: parsed.data.category,
    p_image_path: parsed.data.imagePath || null,
    p_notes: parsed.data.notes,
  });
  if (error) return errorState(dbErrorMessage(error));

  if (previousImagePath && previousImagePath !== parsed.data.imagePath) {
    try {
      const { error: removeError } = await supabase.storage.from("surprise-covers").remove([previousImagePath]);
      if (removeError) return successState("Sorpresa guardada. No se pudo eliminar la imagen anterior.");
    } catch {
      return successState("Sorpresa guardada. No se pudo eliminar la imagen anterior.");
    }
  }
  return successState(parsed.data.appointmentId ? "Sorpresa actualizada para los dos." : "¡La sorpresa quedó preparada!");
}

export async function createBudgetProposal(formData: FormData): Promise<FormState> {
  if (!(await getUser())) return errorState(SESSION_EXPIRED);
  const parsed = budgetProposalSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    requestKey: formData.get("requestKey"),
    proposerAmount: formData.get("proposerAmount"),
    recipientAmount: formData.get("recipientAmount"),
    message: formData.get("message") ?? "",
  });
  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_appointment_budget_proposal", {
    p_appointment_id: parsed.data.appointmentId,
    p_request_key: parsed.data.requestKey,
    p_proposer_amount: parsed.data.proposerAmount,
    p_recipient_amount: parsed.data.recipientAmount,
    p_message: parsed.data.message,
  });
  if (error) return errorState(dbErrorMessage(error));
  return successState("Propuesta enviada. El acuerdo solo cambia cuando ambos la aceptan.");
}

export async function respondToBudgetProposal(formData: FormData): Promise<FormState> {
  if (!(await getUser())) return errorState(SESSION_EXPIRED);
  const parsed = budgetResponseSchema.safeParse({
    proposalId: formData.get("proposalId"),
    action: formData.get("action"),
    requestKey: formData.get("requestKey") ?? "",
    proposerAmount: formData.get("proposerAmount") ?? "",
    recipientAmount: formData.get("recipientAmount") ?? "",
    message: formData.get("message") ?? "",
  });
  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_to_appointment_budget_proposal", {
    p_proposal_id: parsed.data.proposalId,
    p_action: parsed.data.action,
    p_request_key: parsed.data.requestKey,
    p_proposer_amount: parsed.data.proposerAmount,
    p_recipient_amount: parsed.data.recipientAmount,
    p_message: parsed.data.message,
  });
  if (error) return errorState(dbErrorMessage(error));
  const message = parsed.data.action === "accept"
    ? "Propuesta aceptada. El acuerdo quedó actualizado para ambos."
    : parsed.data.action === "reject"
      ? "Propuesta rechazada. No se creó ningún compromiso."
      : "Contraoferta enviada; el acuerdo vigente no cambia hasta que la acepten.";
  return successState(message);
}

export async function addAppointmentExpense(formData: FormData): Promise<FormState> {
  if (!(await getUser())) return errorState(SESSION_EXPIRED);
  const parsed = appointmentExpenseSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    requestKey: formData.get("requestKey"),
    concept: formData.get("concept"),
    amount: formData.get("amount"),
    paidBy: formData.get("paidBy"),
    coveredBy: formData.get("coveredBy"),
  });
  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_appointment_expense", {
    p_appointment_id: parsed.data.appointmentId,
    p_request_key: parsed.data.requestKey,
    p_concept: parsed.data.concept,
    p_amount: parsed.data.amount,
    p_paid_by: parsed.data.paidBy,
    p_covered_by: parsed.data.coveredBy,
  });
  if (error) return errorState(dbErrorMessage(error));
  return successState("Gasto registrado, sin generar deudas ni transferencias.");
}

export async function deleteAppointment(appointmentId: string): Promise<FormState> {
  if (!(await getUser())) return errorState(SESSION_EXPIRED);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(appointmentId)) {
    return errorState(GENERIC_ERROR);
  }

  const { supabase, coupleId, error: coupleError } = await getCurrentCoupleId();
  if (coupleError) return errorState(dbErrorMessage(coupleError));
  if (!coupleId) return errorState(dbErrorMessage({ message: "not_in_couple" }));

  const { data: current, error: readError } = await supabase
    .from("appointments")
    .select("is_surprise")
    .eq("id", appointmentId)
    .eq("couple_id", coupleId)
    .maybeSingle();
  if (readError) return errorState(dbErrorMessage(readError));
  if (!current) return errorState("No encontramos esa cita en vuestro espacio.");
  let surpriseImagePath: string | null = null;
  if (current.is_surprise) {
    const { data, error } = await supabase
      .from("appointment_surprise_details")
      .select("image_path")
      .eq("appointment_id", appointmentId)
      .maybeSingle();
    if (error) return errorState(dbErrorMessage(error));
    surpriseImagePath = data?.image_path ?? null;
  }

  const { data: deleted, error } = await supabase
    .from("appointments")
    .delete()
    .eq("id", appointmentId)
    .eq("couple_id", coupleId)
    .select("image_path")
    .maybeSingle();
  if (error) return errorState(dbErrorMessage(error));
  if (!deleted) return errorState("No encontramos esa cita en vuestro espacio.");

  let message = "Cita eliminada.";
  if (deleted.image_path) {
    if (!(await removeCover(supabase, deleted.image_path))) message += " No se pudo eliminar la portada.";
  }
  if (surpriseImagePath) {
    try {
      const { error: removeError } = await supabase.storage.from("surprise-covers").remove([surpriseImagePath]);
      if (removeError) message += " No se pudo eliminar la imagen de la sorpresa.";
    } catch {
      message += " No se pudo eliminar la imagen de la sorpresa.";
    }
  }
  return successState(message);
}
