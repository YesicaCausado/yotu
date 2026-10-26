import { LogOut } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { getMyProfile } from "@/lib/dal";
import { signOut } from "@/features/auth/actions";

export async function UserMenu() {
  const profile = await getMyProfile();

  return (
    <div className="flex items-center gap-2">
      <Avatar name={profile.display_name} url={profile.avatarUrl} size="sm" />
      <form action={signOut}>
        <button
          type="submit"
          className="inline-flex size-9 items-center justify-center rounded-full text-ink-500 transition-colors hover:bg-blush-100 hover:text-wine-700"
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
        >
          <LogOut className="size-4" aria-hidden />
        </button>
      </form>
    </div>
  );
}
