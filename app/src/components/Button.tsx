import { ButtonHTMLAttributes, forwardRef, ReactNode } from "react";

type Variant = "default" | "primary" | "danger" | "ghost";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: ReactNode;
};

const base =
  "font-mono font-bold uppercase tracking-[0.18em] cursor-pointer transition-all duration-200 inline-flex items-center justify-center gap-2 min-h-[44px] disabled:opacity-35 disabled:cursor-not-allowed text-[0.85rem]";

const variants: Record<Variant, string> = {
  default:
    "px-5 py-3 border-2 border-border bg-panel text-text hover:border-green hover:text-green hover:shadow-[0_0_32px_rgba(0,255,136,.2)]",
  primary:
    "px-5 py-3 border-2 border-green text-green bg-transparent hover:bg-green hover:text-black hover:shadow-[0_0_60px_rgba(0,255,136,.5)]",
  danger:
    "px-5 py-3 border-2 border-red text-red bg-transparent hover:bg-red hover:text-white hover:shadow-[0_0_60px_rgba(255,51,85,.55)] animate-pulse-red",
  ghost:
    "px-3 py-2 border border-border bg-panel-2 text-muted text-xs hover:border-green hover:text-text",
};

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = "default", className = "", children, ...rest }, ref) => (
    <button
      ref={ref}
      type="button"
      className={`${base} ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  ),
);
Button.displayName = "Button";
