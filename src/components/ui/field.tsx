import { useId, type ComponentProps, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

const inputClass =
  "w-full h-11 rounded-xl border border-line bg-cream-50 px-4 text-[15px] text-ink-900 placeholder:text-ink-300 transition-colors focus:border-wine-500 focus:outline-none focus:ring-2 focus:ring-blush-200 aria-invalid:border-danger-700 disabled:opacity-60";

type FieldProps = ComponentProps<"input"> & {
  label: string;
  hint?: ReactNode;
  errors?: string[];
};

export function Field({ label, hint, errors, id, className = "", ...props }: FieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = [hint ? `${inputId}-hint` : null, errors?.length ? `${inputId}-error` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-ink-700">
        {label}
      </label>
      <input
        id={inputId}
        className={`${inputClass} ${className}`}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...props}
      />
      {hint && !errors?.length && (
        <p id={`${inputId}-hint`} className="text-xs text-ink-500">
          {hint}
        </p>
      )}
      {errors?.length ? (
        <p id={`${inputId}-error`} className="text-xs text-danger-700">
          {errors[0]}
        </p>
      ) : null}
    </div>
  );
}

type SelectProps = ComponentProps<"select"> & { label: string; errors?: string[] };

export function SelectField({ label, errors, id, className = "", children, ...props }: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={selectId} className="text-sm font-medium text-ink-700">
        {label}
      </label>
      <div className="relative">
        <select
          id={selectId}
          className={`${inputClass} appearance-none pr-10 ${className}`}
          aria-invalid={errors?.length ? true : undefined}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-ink-500" aria-hidden />
      </div>
      {errors?.length ? <p className="text-xs text-danger-700">{errors[0]}</p> : null}
    </div>
  );
}
