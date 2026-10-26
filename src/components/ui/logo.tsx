import Link from "next/link";
import { Heart } from "lucide-react";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 text-wine-700">
      <Heart className="size-5 fill-blush-300 stroke-wine-600" aria-hidden />
      <span className="font-display text-2xl font-semibold tracking-wide">Yotu</span>
    </Link>
  );
}
