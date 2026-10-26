"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HeartHandshake, House, UserRound } from "lucide-react";

// Solo se muestran secciones ya implementadas; las fases siguientes añadirán las suyas.
const items = [
  { href: "/inicio", label: "Inicio", Icon: House },
  { href: "/pareja", label: "Pareja", Icon: HeartHandshake },
  { href: "/perfil", label: "Perfil", Icon: UserRound },
];

export function AppNav({ variant }: { variant: "top" | "bottom" }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  if (variant === "top") {
    return (
      <nav aria-label="Principal" className="hidden sm:block">
        <ul className="flex items-center gap-1">
          {items.map(({ href, label }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className="rounded-full px-4 py-2 text-sm text-ink-700 transition-colors hover:bg-blush-100 aria-[current=page]:bg-blush-100 aria-[current=page]:font-medium aria-[current=page]:text-wine-700"
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-cream-50/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-3">
        {items.map(({ href, label, Icon }) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className="flex flex-col items-center gap-1 py-2.5 text-xs text-ink-500 transition-colors aria-[current=page]:text-wine-600"
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
