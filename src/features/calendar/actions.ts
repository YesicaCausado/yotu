"use client";

import { createClient } from "@/lib/supabase/client";
import { getUser } from "@/lib/dal";
import { dbErrorMessage, GENERIC_ERROR } from "@/lib/errors";
import { errorState, successState, validationError, type FormState } from "@/lib/form";
import { personalActivitySchema, personalDayNoteSchema } from "@/lib/validation";

const SESSION_EXPIRED = "Tu sesión ha caducado. Vuelve a iniciar sesión.";

export async function savePersonalActivity(formData: FormData): Promise<FormState> {
  if (!(await getUser())) return errorState(SESSION_EXPIRED);

  const parsed = personalActivitySchema.safeParse({
    activityId: formData.get("activityId") ?? "",
    requestKey: formData.get("requestKey"),
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    activityDate: formData.get("activityDate"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    category: formData.get("category"),
    location: formData.get("location") ?? "",
    personalNotes: formData.get("personalNotes") ?? "",
    color: formData.get("color"),
    visibility: formData.get("visibility"),
  });
  if (!parsed.success) return validationError(parsed.error);

  const supabase = createClient();
  const { error } = await supabase.rpc("save_personal_activity", {
    p_activity_id: parsed.data.activityId || null,
    p_request_key: parsed.data.requestKey,
    p_title: parsed.data.title,
    p_description: parsed.data.description,
    p_activity_date: parsed.data.activityDate,
    p_start_time: parsed.data.startTime,
    p_end_time: parsed.data.endTime,
    p_category: parsed.data.category,
    p_location: parsed.data.location,
    p_personal_notes: parsed.data.personalNotes,
    p_color: parsed.data.color,
    p_visibility: parsed.data.visibility,
  });
  if (error) return errorState(dbErrorMessage(error));
  return successState("Actividad guardada en tu calendario.");
}

export async function deletePersonalActivity(activityId: string): Promise<FormState> {
  if (!(await getUser())) return errorState(SESSION_EXPIRED);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(activityId)) {
    return errorState(GENERIC_ERROR);
  }

  const supabase = createClient();
  const { error } = await supabase.rpc("delete_personal_activity", { p_activity_id: activityId });
  if (error) return errorState(dbErrorMessage(error));
  return successState("Actividad eliminada.");
}

export async function savePersonalDayNote(formData: FormData): Promise<FormState> {
  const user = await getUser();
  if (!user) return errorState(SESSION_EXPIRED);

  const parsed = personalDayNoteSchema.safeParse({
    id: formData.get("id") ?? "",
    requestKey: formData.get("requestKey"),
    noteDate: formData.get("noteDate"),
    title: formData.get("title"),
    content: formData.get("content") ?? "",
    reminderAt: formData.get("reminderAt") ?? "",
    isTask: formData.get("isTask") === "on",
  });
  if (!parsed.success) return validationError(parsed.error);

  const supabase = createClient();
  if (parsed.data.id) {
    const { data, error } = await supabase
      .from("personal_day_notes")
      .update({
        note_date: parsed.data.noteDate,
        title: parsed.data.title,
        content: parsed.data.content,
        reminder_at: parsed.data.reminderAt,
        is_task: parsed.data.isTask,
      })
      .eq("id", parsed.data.id)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();
    if (error) return errorState(dbErrorMessage(error));
    if (!data) return errorState("No encontramos esta nota en tu calendario.");
    return successState("Nota actualizada.");
  }

  const { error } = await supabase.from("personal_day_notes").insert({
    user_id: user.id,
    request_key: parsed.data.requestKey,
    note_date: parsed.data.noteDate,
    title: parsed.data.title,
    content: parsed.data.content,
    reminder_at: parsed.data.reminderAt,
    is_task: parsed.data.isTask,
  });
  if (error?.code === "23505") return successState("Este apunte ya estaba guardado.");
  if (error) return errorState(dbErrorMessage(error));
  return successState(parsed.data.isTask ? "Pendiente añadido." : "Nota guardada.");
}

export async function setPersonalTaskCompleted(noteId: string, completed: boolean): Promise<FormState> {
  const user = await getUser();
  if (!user) return errorState(SESSION_EXPIRED);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(noteId)) {
    return errorState(GENERIC_ERROR);
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("personal_day_notes")
    .update({ is_completed: completed })
    .eq("id", noteId)
    .eq("user_id", user.id)
    .eq("is_task", true)
    .select("id")
    .maybeSingle();
  if (error) return errorState(dbErrorMessage(error));
  if (!data) return errorState("No encontramos este pendiente en tu calendario.");
  return successState(completed ? "Pendiente completado." : "Pendiente reabierto.");
}

export async function deletePersonalDayNote(noteId: string): Promise<FormState> {
  const user = await getUser();
  if (!user) return errorState(SESSION_EXPIRED);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(noteId)) {
    return errorState(GENERIC_ERROR);
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("personal_day_notes")
    .delete()
    .eq("id", noteId)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();
  if (error) return errorState(dbErrorMessage(error));
  if (!data) return errorState("No encontramos esta nota en tu calendario.");
  return successState("Nota eliminada.");
}
