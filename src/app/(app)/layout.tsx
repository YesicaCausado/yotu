"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import { AppNav } from "@/components/layout/app-nav";
import { BudgetNotificationLink } from "@/components/layout/budget-notification-link";
import { CoupleTalkNotificationLink } from "@/components/layout/couple-talk-notification-link";
import { SurpriseNotificationLink } from "@/components/layout/surprise-notification-link";
import { UserMenu } from "@/components/layout/user-menu";
import { getUser } from "@/lib/dal";
import { Alert } from "@/components/ui/alert";

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);
  const [authCheckFailed, setAuthCheckFailed] = useState(false);

  useEffect(() => {
    let active = true;
    getUser().then((user) => {
      if (!active) return;
      if (!user) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      setAuthorized(true);
    }).catch(() => {
      if (active) setAuthCheckFailed(true);
    });
    return () => { active = false; };
  }, [pathname, router]);

  if (!authorized) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 text-sm text-ink-500">
        {authCheckFailed ? (
          <Alert tone="error">No se pudo comprobar tu sesión. Comprueba tu conexión e inténtalo de nuevo.</Alert>
        ) : "Cargando vuestro espacio…"}
      </main>
    );
  }

  return (
    <div className="flex flex-1 flex-col pb-24 sm:pb-0">
      <header className="sticky top-0 z-20 border-b border-line/70 bg-cream-100/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4">
          <Logo href="/inicio" />
          <AppNav variant="top" />
          <BudgetNotificationLink />
          <SurpriseNotificationLink />
          <CoupleTalkNotificationLink />
          <UserMenu />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-10">{children}</main>
      <AppNav variant="bottom" />
    </div>
  );
}
