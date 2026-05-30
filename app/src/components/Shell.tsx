import { ReactNode } from "react";
import { useEffect } from "react";

interface ShellProps {
  /** Adds `body.state-${state}` so theme tokens shift accordingly. */
  state?: string;
  /** Optional class applied to <body> (e.g., 'demo-mode'). */
  bodyClass?: string;
  children: ReactNode;
}

/** Sets up body-level state classes + renders corner brackets. */
export function Shell({ state, bodyClass, children }: ShellProps) {
  useEffect(() => {
    const body = document.body;
    const stateClasses = [
      "state-active", "state-warning", "state-critical", "state-expired",
      "state-empty", "state-watching", "state-nearing", "state-claimable", "state-claimed",
    ];
    stateClasses.forEach((c) => body.classList.remove(c));
    if (state) body.classList.add(`state-${state}`);
    if (bodyClass) body.classList.add(bodyClass);
    return () => {
      if (bodyClass) body.classList.remove(bodyClass);
    };
  }, [state, bodyClass]);

  return (
    <div className="min-h-screen relative">
      <CornerBrackets />
      {children}
    </div>
  );
}

function CornerBrackets() {
  const c =
    "absolute w-[18px] h-[18px] opacity-50 transition-all duration-400 pointer-events-none";
  const color = "border-[var(--status,#00FF88)]";
  return (
    <>
      <span aria-hidden className={`${c} ${color} top-5 left-5 border-t border-l`} />
      <span aria-hidden className={`${c} ${color} top-5 right-5 border-t border-r`} />
      <span aria-hidden className={`${c} ${color} bottom-5 left-5 border-b border-l`} />
      <span aria-hidden className={`${c} ${color} bottom-5 right-5 border-b border-r`} />
    </>
  );
}
