import { Suspense } from "react";
import { Logo } from "@/components/ui/logo";
import { AppNav } from "@/components/layout/app-nav";
import { UserMenu } from "@/components/layout/user-menu";
import { requireUser } from "@/lib/dal";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Defensa en profundidad: además de proxy.ts, cada página vuelve a validar.
  await requireUser();

  return (
    <div className="flex flex-1 flex-col pb-24 sm:pb-0">
      <header className="sticky top-0 z-20 border-b border-line/70 bg-cream-100/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4">
          <Logo href="/inicio" />
          <AppNav variant="top" />
          <Suspense fallback={<span className="size-9 rounded-full bg-blush-100" />}>
            <UserMenu />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-10">{children}</main>
      <AppNav variant="bottom" />
    </div>
  );
}
