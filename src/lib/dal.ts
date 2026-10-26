import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Couple, Profile } from "@/types/database";

export type ProfileWithAvatar = Profile & { avatarUrl: string | null };

export type CoupleContext = {
  couple: Couple;
  partner: ProfileWithAvatar | null;
};

/**
 * Usuario autenticado verificado contra Supabase Auth (no solo la cookie).
 * Se memoiza por petición.
 */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
});

/** Igual que getUser, pero redirige al login si no hay sesión. */
export async function requireUser(next?: string) {
  const user = await getUser();
  if (!user) {
    redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  }
  return user;
}

async function withAvatarUrls(profiles: Profile[]): Promise<ProfileWithAvatar[]> {
  const paths = profiles.map((p) => p.avatar_path).filter((p): p is string => Boolean(p));
  const urls = new Map<string, string>();

  if (paths.length > 0) {
    const supabase = await createClient();
    const { data } = await supabase.storage.from("avatars").createSignedUrls(paths, 60 * 60);
    data?.forEach((item) => {
      if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
    });
  }

  return profiles.map((p) => ({ ...p, avatarUrl: p.avatar_path ? (urls.get(p.avatar_path) ?? null) : null }));
}

/** Perfil del usuario actual (con URL firmada del avatar). */
export const getMyProfile = cache(async (): Promise<ProfileWithAvatar> => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (error || !data) throw new Error("No se pudo cargar tu perfil.");
  const [profile] = await withAvatarUrls([data]);
  return profile;
});

/**
 * Pareja del usuario actual y perfil de la otra persona, o null si todavía no
 * tiene pareja. La RLS garantiza que solo se devuelven datos propios.
 */
export const getCoupleContext = cache(async (): Promise<CoupleContext | null> => {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("couple_members")
    .select("couple_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return null;

  const [{ data: couple }, { data: members }] = await Promise.all([
    supabase.from("couples").select("*").eq("id", membership.couple_id).single(),
    supabase.from("couple_members").select("user_id").eq("couple_id", membership.couple_id),
  ]);
  if (!couple) return null;

  const partnerId = members?.find((m) => m.user_id !== user.id)?.user_id;
  let partner: ProfileWithAvatar | null = null;
  if (partnerId) {
    const { data } = await supabase.from("profiles").select("*").eq("id", partnerId).maybeSingle();
    if (data) [partner] = await withAvatarUrls([data]);
  }

  return { couple, partner };
});
