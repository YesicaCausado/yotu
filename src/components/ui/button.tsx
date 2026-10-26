"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 h-11 text-sm font-medium transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed select-none";

const variants: Record<Variant, string> = {
  primary: "bg-wine-600 text-cream-50 hover:bg-wine-700 shadow-soft",
  secondary: "bg-cream-50 text-wine-700 border border-line hover:bg-blush-100",
  ghost: "text-wine-700 hover:bg-blush-100",
  danger: "bg-danger-700 text-white hover:bg-[#8a2a30]",
};

export function buttonClass(variant: Variant = "primary", className = "") {
  return `${base} ${variants[variant]} ${className}`;
}

type ButtonProps = ComponentProps<"button"> & { variant?: Variant; pending?: boolean };

export function Button({ variant = "primary", pending, className = "", children, disabled, ...props }: ButtonProps) {
  return (
    <button className={buttonClass(variant, className)} disabled={disabled || pending} aria-busy={pending} {...props}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

/** Botón de envío que muestra el estado pendiente del formulario padre. */
export function SubmitButton({
  children,
  pendingText,
  ...props
}: Omit<ButtonProps, "type" | "pending"> & { pendingText?: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" pending={pending} {...props}>
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}
