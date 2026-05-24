import type { ButtonHTMLAttributes } from "react";
import { cn } from "../lib/cn";

type ButtonVariant = "primary" | "ghost" | "glass";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-orange-500 to-purple-600 text-white shadow-lg shadow-orange-500/20 hover:brightness-110",
  ghost: "bg-transparent text-zinc-200 hover:bg-white/5",
  glass:
    "bg-white/5 text-zinc-100 border border-white/10 backdrop-blur-md hover:bg-white/10",
};

export function Button({
  className,
  variant = "glass",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition",
        "disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
