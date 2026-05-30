import { ReactNode } from "react";

export function Stamp({
  children,
  className = "",
  tone = "muted",
}: {
  children: ReactNode;
  className?: string;
  tone?: "muted" | "text" | "green" | "amber" | "red" | "violet";
}) {
  const tones = {
    muted: "text-muted",
    text: "text-text",
    green: "text-green glow-green",
    amber: "text-amber glow-amber",
    red: "text-red glow-red",
    violet: "text-violet glow-violet",
  };
  return (
    <span className={`stamp ${tones[tone]} ${className}`}>{children}</span>
  );
}
