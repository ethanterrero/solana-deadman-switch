import { ReactNode, useEffect, useRef } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  tag?: ReactNode;
  subtitle?: ReactNode;
  variant?: "default" | "danger";
  children: ReactNode;
  /** Optional footer override; defaults to caller-supplied actions inside children. */
  footer?: ReactNode;
  maxWidth?: string;
  /** Used for aria-labelledby. */
  titleId?: string;
}

/**
 * Focus-trapped modal with ESC + click-outside + return-focus-on-close.
 * The static mockup's modal escaped to the page behind on Tab — this one doesn't.
 */
export function Modal({
  open,
  onClose,
  title,
  tag,
  subtitle,
  variant = "default",
  children,
  footer,
  maxWidth = "560px",
  titleId,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreFocusTo.current = document.activeElement as HTMLElement | null;

    // Focus the dialog so screen readers announce
    requestAnimationFrame(() => {
      const first = dialogRef.current?.querySelector<HTMLElement>(
        "input, button, [href], textarea, select, [tabindex]:not([tabindex='-1'])",
      );
      first?.focus();
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Tab") {
        // simple focus trap
        const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
          "input:not([disabled]), button:not([disabled]), [href], textarea, select, [tabindex]:not([tabindex='-1'])",
        );
        if (!focusables || focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);

    // Lock body scroll
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      restoreFocusTo.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const borderClr = variant === "danger" ? "var(--red)" : "var(--green)";

  return (
    <div
      role={variant === "danger" ? "alertdialog" : "dialog"}
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[180] flex items-center justify-center p-6 backdrop-blur-[4px]"
      style={{ background: "rgba(0,0,0,.78)", animation: "modalIn 200ms ease" }}
    >
      <div
        ref={dialogRef}
        className="relative bg-panel border border-border p-8"
        style={{ maxWidth, width: "100%", animation: "modalSlide 280ms cubic-bezier(.2,.8,.2,1)" }}
      >
        {/* Corner brackets */}
        <span
          aria-hidden
          className="absolute top-[-1px] left-[-1px] w-3.5 h-3.5"
          style={{ borderTop: `2px solid ${borderClr}`, borderLeft: `2px solid ${borderClr}` }}
        />
        <span
          aria-hidden
          className="absolute top-[-1px] right-[-1px] w-3.5 h-3.5"
          style={{ borderTop: `2px solid ${borderClr}`, borderRight: `2px solid ${borderClr}` }}
        />
        <span
          aria-hidden
          className="absolute bottom-[-1px] left-[-1px] w-3.5 h-3.5"
          style={{ borderBottom: `2px solid ${borderClr}`, borderLeft: `2px solid ${borderClr}` }}
        />
        <span
          aria-hidden
          className="absolute bottom-[-1px] right-[-1px] w-3.5 h-3.5"
          style={{ borderBottom: `2px solid ${borderClr}`, borderRight: `2px solid ${borderClr}` }}
        />

        <header className="mb-6">
          {tag && (
            <div className="stamp mb-2.5 inline-flex items-center gap-2" style={{ color: borderClr }}>
              {tag}
            </div>
          )}
          <h3
            id={titleId}
            className="font-mono font-extrabold text-2xl tracking-tight text-text leading-tight m-0"
          >
            <span style={{ color: borderClr }}>{variant === "danger" ? "!" : ">"}</span>{" "}
            {title}
          </h3>
          {subtitle && (
            <p className="text-muted text-sm leading-relaxed mt-2">{subtitle}</p>
          )}
        </header>

        <div className="flex flex-col gap-4">{children}</div>

        {footer && <footer className="flex justify-between items-center gap-3 mt-7">{footer}</footer>}

        <style>{`
          @keyframes modalIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes modalSlide {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @media (prefers-reduced-motion: reduce) {
            div[role="dialog"], div[role="alertdialog"], div[role="dialog"] > div, div[role="alertdialog"] > div {
              animation: none !important;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
