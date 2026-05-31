import { Link } from "react-router-dom";

export function BackLink({ to, label = "BACK" }: { to: string; label?: string }) {
  return (
    <Link
      to={to}
      className="text-muted no-underline text-[0.7rem] tracking-[0.25em] uppercase px-3.5 py-2 border border-border bg-panel-2 transition-colors duration-200 inline-flex items-center gap-2.5 hover:text-text hover:border-green min-h-[36px]"
    >
      <span aria-hidden>◀</span>
      <span>{label}</span>
    </Link>
  );
}
