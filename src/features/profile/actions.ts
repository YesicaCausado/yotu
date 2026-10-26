"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/dal";
import { GENERIC_ERROR } from "@/lib/errors";
import { errorState, successState, validationError, withValues, type FormState } from "@/lib/form";
import { isOwnAvatarPath, profileSchema } from "@/lib/validation";

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  return withValues(await updateProfileImpl(formData), formData, ["displayName", "birthday", "timezone"]);
}

async function updateProfileImpl(formData: FormData): Promise<FormState> {
  const user = await getUser();
  if (!user) return errorState("Tu sesión ha caducado. Vuelve a iniciar sesión.");

  const parsed = profileSchema.safeParse({
    displayName: formData.get("displayName"),
    birthday: formData.get("birthday") ?? "",
    timezone: formData.get("timezone"),
  });
  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      birthday: parsed.data.birthday,
      timezone: parsed.data.timezone,
    })
    .eq("id", user.id);
  if (error) return errorState(GENERIC_ERROR);

  revalidatePath("/", "layout");
  return successState("Perfil guardado.");
}

/**
 * Se llama después de que el navegador sube la imagen a Storage (la RLS solo
 * permite subir a la carpeta propia). Aquí se valida la ruta y se limpia el
 * avatar anterior.
 */
export async function setAvatar(path: string): Promise<FormState> {
  const user = await getUser();
  if (!user) return errorState("Tu sesión ha caducado. Vuelve a iniciar sesión.");
  if (typeof path !== "string" || !isOwnAvatarPath(path, user.id)) {
    return errorState("La imagen no es válida.");
  }

  const supabase = await createClient();
  const { error: checkError } = await supabase.storage.from("avatars").createSignedUrl(path, 10);
  if (checkError) return errorState("No encontramos la imagen subida. Inténtalo de nuevo.");

  const { data: current } = await supabase.from("profiles").select("avatar_path").eq("id", user.id).single();
  const { error } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", user.id);
  if (error) return errorState(GENERIC_ERROR);

  if (current?.avatar_path && current.avatar_path !== path) {
    await supabase.storage.from("avatars").remove([current.avatar_path]);
  }

  revalidatePath("/", "layout");
  return successState("Foto actualizada.");
}

export async function removeAvatar(): Promise<FormState> {
  const user = await getUser();
  if (!user) return errorState("Tu sesión ha caducado. Vuelve a iniciar sesión.");

  const supabase = await createClient();
  const { data: current } = await supabase.from("profiles").select("avatar_path").eq("id", user.id).single();
  const { error } = await supabase.from("profiles").update({ avatar_path: null }).eq("id", user.id);
  if (error) return errorState(GENERIC_ERROR);

  if (current?.avatar_path) {
    await supabase.storage.from("avatars").remove([current.avatar_path]);
  }

  revalidatePath("/", "layout");
  return successState("Foto eliminada.");
}
