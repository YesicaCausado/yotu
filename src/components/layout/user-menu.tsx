"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { getMyProfile } from "@/lib/dal";
import { signOut } from "@/features/auth/actions";
import type { ProfileWithAvatar } from "@/lib/dal";

export function UserMenu() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileWithAvatar | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    getMyProfile().then((value) => {
      if (active) setProfile(value);
    }).catch(() => {
      if (active) setProfile(null);
    });
    return () => { active = false; };
  }, []);

  const logout = () => startTransition(async () => {
    const state = await signOut();
    if (state.redirectTo) router.replace(state.redirectTo);
  });

  return (
    <div className="flex items-center gap-2">
      {profile && <Avatar name={profile.display_name} url={profile.avatarUrl} size="sm" />}
      <button
        type="button"
        onClick={logout}
        disabled={pending}
        className="inline-flex size-9 items-center justify-center rounded-full text-ink-500 transition-colors hover:bg-blush-100 hover:text-wine-700 disabled:opacity-60"
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
      >
        <LogOut className="size-4" aria-hidden />
      </button>
    </div>
  );
}
