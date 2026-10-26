"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/dal";
import { env } from "@/lib/env";
import { dbErrorMessage, GENERIC_ERROR } from "@/lib/errors";
import { errorState, successState, validationError, withValues, type FormState } from "@/lib/form";
import { coupleSchema, invitationTokenSchema } from "@/lib/validation";

const SESSION_EXPIRED = "Tu sesión ha caducado. Vuelve a iniciar sesión.";
const COUPLE_FIELDS = ["name", "anniversaryDate", "timezone"];

export async function createCouple(_prev: FormState, formData: FormData): Promise<FormState> {
  return withValues(await createCoupleImpl(formData), formData, COUPLE_FIELDS);
}

async function createCoupleImpl(formData: FormData): Promise<FormState> {
  if (!(await getUser())) return errorState(SESSION_EXPIRED);

  const parsed = coupleSchema.safeParse({
    name: formData.get("name") ?? "",
    anniversaryDate: formData.get("anniversaryDate") ?? "",
    timezone: formData.get("timezone"),
  });
  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_couple", {
    p_name: parsed.data.name,
    p_anniversary_date: parsed.data.anniversaryDate,
    p_timezone: parsed.data.timezone,
  });
  if (error) return errorState(dbErrorMessage(error));

  revalidatePath("/", "layout");
  redirect("/pareja");
}

export async function updateCouple(_prev: FormState, formData: FormData): Promise<FormState> {
  return withValues(await updateCoupleImpl(formData), formData, COUPLE_FIELDS);
}

async function updateCoupleImpl(formData: FormData): Promise<FormState> {
  if (!(await getUser())) return errorState(SESSION_EXPIRED);

  const parsed = coupleSchema.safeParse({
    name: formData.get("name") ?? "",
    anniversaryDate: formData.get("anniversaryDate") ?? "",
    timezone: formData.get("timezone"),
  });
  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createClient();
  // La RLS limita la actualización a la pareja propia; current_couple_id se
  // deduce de la sesión, no del formulario.
  const { data: coupleId } = await supabase.rpc("current_couple_id");
  if (!coupleId) return errorState(dbErrorMessage({ message: "not_in_couple" }));

  const { error } = await supabase
    .from("couples")
    .update({
      name: parsed.data.name,
      anniversary_date: parsed.data.anniversaryDate,
      timezone: parsed.data.timezone,
    })
    .eq("id", coupleId);
  if (error) return errorState(GENERIC_ERROR);

  revalidatePath("/", "layout");
  return successState("Datos de la pareja guardados.");
}

export type InvitationState = FormState & { inviteUrl?: string; expiresAt?: string };

export async function createInvitation(): Promise<InvitationState> {
  if (!(await getUser())) return errorState(SESSION_EXPIRED);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_invitation");
  const row = data?.[0];
  if (error || !row) return errorState(dbErrorMessage(error));

  revalidatePath("/pareja");
  return {
    status: "success",
    message: "Enlace creado. Compártelo solo con tu pareja.",
    inviteUrl: `${env.siteUrl()}/invitacion/${row.token}`,
    expiresAt: row.expires_at,
  };
}

export async function revokeInvitation(invitationId: string): Promise<FormState> {
  if (!(await getUser())) return errorState(SESSION_EXPIRED);
  if (!z.uuid().safeParse(invitationId).success) return errorState(GENERIC_ERROR);

  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_invitation", { p_invitation_id: invitationId });
  if (error) return errorState(dbErrorMessage(error));

  revalidatePath("/pareja");
  return successState("Invitación anulada.");
}

export async function acceptInvitation(token: string): Promise<FormState> {
  if (!(await getUser())) return errorState(SESSION_EXPIRED);
  if (!invitationTokenSchema.safeParse(token).success) {
    return errorState(dbErrorMessage({ message: "invalid_invitation" }));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error) return errorState(dbErrorMessage(error));

  revalidatePath("/", "layout");
  redirect("/inicio?bienvenida=1");
}

export async function leaveCouple(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await getUser())) return errorState(SESSION_EXPIRED);
  if (formData.get("confirm") !== "SALIR") {
    return errorState("Escribe SALIR para confirmar.", { confirm: ["Escribe SALIR en mayúsculas."] });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_couple");
  if (error) return errorState(dbErrorMessage(error));

  revalidatePath("/", "layout");
  redirect("/inicio");
}
