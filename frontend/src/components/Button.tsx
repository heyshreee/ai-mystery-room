import type { ButtonHTMLAttributes, ReactNode } from "react";
import { buttonClasses } from "./button-classes";
import { Spinner } from "./Spinner";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
  loadingLabel?: string;
  icon?: ReactNode;
}

export function Button({
  variant = "primary",
  loading = false,
  loadingLabel = "Working…",
  icon,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={buttonClasses(variant, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? <Spinner className="size-4" /> : icon}
      <span>{loading ? loadingLabel : children}</span>
    </button>
  );
}
