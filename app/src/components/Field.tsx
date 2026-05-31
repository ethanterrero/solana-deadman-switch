import { InputHTMLAttributes, forwardRef, ReactNode } from "react";

// Omit the native `size` (number) so our variant prop doesn't collide with it.
type FieldSize = "default" | "big" | "mega";
type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  size?: FieldSize;
  invalid?: boolean;
};

const sizes: Record<FieldSize, string> = {
  default: "px-3 py-2.5 text-base",
  big: "px-5 py-5 text-xl font-semibold",
  mega: "px-5 py-6 text-6xl font-extrabold text-center tracking-tighter text-green [text-shadow:0_0_14px_rgba(0,255,136,.5)]",
};

export const Field = forwardRef<HTMLInputElement, Props>(
  ({ size = "default", invalid, className = "", ...rest }, ref) => (
    <input
      ref={ref}
      className={`w-full bg-[#050505] border font-mono text-text outline-none transition-all duration-200 ${
        sizes[size]
      } ${
        invalid
          ? "border-red shadow-[0_0_0_1px_var(--red)]"
          : "border-border focus:border-green focus:shadow-[0_0_0_1px_var(--green),0_0_40px_rgba(0,255,136,.15)]"
      } ${className}`}
      autoComplete="off"
      spellCheck={false}
      {...rest}
    />
  ),
);
Field.displayName = "Field";

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="block stamp text-muted-deep mb-1.5 font-medium">
      {children}
    </label>
  );
}

export function FieldHint({
  children,
  variant = "info",
}: {
  children: ReactNode;
  variant?: "info" | "ok" | "bad";
}) {
  const cl =
    variant === "ok" ? "text-green" : variant === "bad" ? "text-red" : "text-muted";
  return <span className={`text-xs ${cl}`}>{children}</span>;
}
