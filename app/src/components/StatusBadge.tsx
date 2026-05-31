import { ReactNode } from "react";
import { HeartbeatDot } from "./HeartbeatDot";

interface Props {
  icon?: ReactNode;
  children: ReactNode;
  sub?: string;
}

export function StatusBadge({ icon = "◇", children, sub }: Props) {
  return (
    <div className="flex items-center justify-center gap-3 flex-wrap">
      <HeartbeatDot />
      <div
        className="inline-flex items-center gap-2.5 px-5 py-2.5 border bg-black/60 font-bold uppercase text-[0.75rem] tracking-[0.3em]"
        style={{
          color: "var(--status)",
          borderColor: "var(--status)",
          boxShadow: "0 0 24px var(--status-glow)",
        }}
      >
        <span aria-hidden className="text-base leading-none">
          {icon}
        </span>
        <span>{children}</span>
      </div>
      {sub && <span className="stamp">{sub}</span>}
    </div>
  );
}
