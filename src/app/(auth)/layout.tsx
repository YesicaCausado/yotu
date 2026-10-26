import { Logo } from "@/components/ui/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col items-center bg-[radial-gradient(ellipse_at_top,var(--color-blush-100),transparent_60%)] px-4 py-10 sm:py-16">
      <div className="mb-8">
        <Logo />
      </div>
      <main className="w-full max-w-md">{children}</main>
    </div>
  );
}
