import { Heart } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import type { ProfileWithAvatar } from "@/lib/dal";

export function CoupleHeader({
  me,
  partner,
  coupleName,
}: {
  me: ProfileWithAvatar;
  partner: ProfileWithAvatar;
  coupleName: string | null;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex items-center">
        <Avatar name={me.display_name} url={me.avatarUrl} size="lg" />
        <span className="z-10 -mx-3 inline-flex size-9 items-center justify-center rounded-full bg-cream-50 shadow-soft">
          <Heart className="size-4 fill-rose-500 stroke-rose-500" aria-hidden />
        </span>
        <Avatar name={partner.display_name} url={partner.avatarUrl} size="lg" />
      </div>
      <p className="mt-4 font-display text-2xl font-semibold text-wine-700">
        {coupleName ?? `${me.display_name} & ${partner.display_name}`}
      </p>
    </div>
  );
}
