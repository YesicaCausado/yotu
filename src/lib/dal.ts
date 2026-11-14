"use client";

import { createClient } from "@/lib/supabase/client";
import type { Appointment, Couple, Database, PersonalDayNote, Profile } from "@/types/database";

export type ProfileWithAvatar = Profile & { avatarUrl: string | null };

export type CoupleContext = {
  couple: Couple;
  partner: ProfileWithAvatar | null;
};

export type AppointmentWithCover = Appointment & { coverUrl: string | null };
export type CalendarActivity = Database["public"]["Functions"]["get_calendar_activities"]["Returns"][number];

/** La sesión se mantiene en el navegador; RLS protege todas las consultas. */
export async function getUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error && error.name !== "AuthSessionMissingError") throw error;
  return data.user;
}

async function withAvatarUrls(profiles: Profile[]): Promise<ProfileWithAvatar[]> {
  const paths = profiles.map((p) => p.avatar_path).filter((p): p is string => Boolean(p));
  const urls = new Map<string, string>();

  if (paths.length > 0) {
    const supabase = await createClient();
    const { data, error } = await supabase.storage.from("avatars").createSignedUrls(paths, 60 * 60);
    if (error) throw new Error("No se pudieron cargar las fotos de perfil.");
    data?.forEach((item) => {
      if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
    });
  }

  return profiles.map((p) => ({ ...p, avatarUrl: p.avatar_path ? (urls.get(p.avatar_path) ?? null) : null }));
}

/** Perfil del usuario actual (con URL firmada del avatar). */
export async function getMyProfile(): Promise<ProfileWithAvatar> {
  const user = await getUser();
  if (!user) throw new Error("Tu sesión ha caducado. Vuelve a iniciar sesión.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (error || !data) throw new Error("No se pudo cargar tu perfil.");
  const [profile] = await withAvatarUrls([data]);
  return profile;
}

/**
 * Pareja del usuario actual y perfil de la otra persona, o null si todavía no
 * tiene pareja. La RLS garantiza que solo se devuelven datos propios.
 */
export async function getCoupleContext(): Promise<CoupleContext | null> {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();

  const { data: membership, error: membershipError } = await supabase
    .from("couple_members")
    .select("couple_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipError) throw new Error("No se pudo cargar vuestro espacio.");
  if (!membership) return null;

  const [{ data: couple, error: coupleError }, { data: members, error: membersError }] = await Promise.all([
    supabase.from("couples").select("*").eq("id", membership.couple_id).single(),
    supabase.from("couple_members").select("user_id").eq("couple_id", membership.couple_id),
  ]);
  if (coupleError || membersError) throw new Error("No se pudo cargar vuestro espacio.");
  if (!couple) return null;

  const partnerId = members?.find((m) => m.user_id !== user.id)?.user_id;
  let partner: ProfileWithAvatar | null = null;
  if (partnerId) {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", partnerId).maybeSingle();
    if (error) throw new Error("No se pudo cargar el perfil de tu pareja.");
    if (data) [partner] = await withAvatarUrls([data]);
  }

  return { couple, partner };
}

/** Citas visibles para la pareja actual, con URL temporal para sus portadas privadas. */
export async function getCoupleAppointments(coupleId: string): Promise<AppointmentWithCover[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("couple_id", coupleId)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true });
  if (error) throw new Error("No se pudieron cargar las citas.");

  const paths = (data ?? []).map((appointment) => appointment.image_path).filter((path): path is string => Boolean(path));
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signedUrls, error: storageError } = await supabase.storage
      .from("appointment-covers")
      .createSignedUrls(paths, 60 * 60);
    if (storageError) throw new Error("No se pudieron cargar las imágenes de las citas.");
    signedUrls?.forEach((item) => {
      if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
    });
  }

  return (data ?? []).map((appointment) => ({
    ...appointment,
    coverUrl: appointment.image_path ? (urls.get(appointment.image_path) ?? null) : null,
  }));
}

export async function getCalendarActivities(from: string, to: string): Promise<CalendarActivity[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_calendar_activities", { p_from: from, p_to: to });
  if (error) throw new Error("No se pudieron cargar las actividades del calendario.");
  return data ?? [];
}

export async function getPersonalDayNotes(date: string): Promise<PersonalDayNote[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("personal_day_notes")
    .select("*")
    .eq("note_date", date)
    .order("reminder_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (error) throw new Error("No se pudieron cargar las notas de este día.");
  return data ?? [];
}
