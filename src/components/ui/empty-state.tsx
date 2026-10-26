import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-8 text-center animate-fade-in">
      <span className="mb-4 inline-flex size-14 items-center justify-center rounded-full bg-blush-100 text-wine-500">
        <Icon className="size-6" aria-hidden />
      </span>
      <h3 className="font-display text-xl font-semibold text-wine-700">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
