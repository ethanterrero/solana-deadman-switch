import { useEffect } from "react";

interface Props {
  message: string | null;
  onDismiss: () => void;
  /** auto-dismiss after N ms (default 6000); 0 disables. */
  timeout?: number;
}

/** Bottom-center error pill. Red-bordered, dismissable, auto-hides. */
export function ErrorToast({ message, onDismiss, timeout = 6000 }: Props) {
  useEffect(() => {
    if (!message || !timeout) return;
    const id = setTimeout(onDismiss, timeout);
    return () => clearTimeout(id);
  }, [message, timeout, onDismiss]);

  if (!message) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[210] max-w-md w-[calc(100%-3rem)] bg-panel border border-red border-l-2 border-l-red px-4 py-3 flex items-start gap-3"
      style={{ boxShadow: "0 0 40px rgba(255,51,85,.25)" }}
    >
      <span className="text-red text-base leading-tight">⚠</span>
      <span className="text-sm text-text leading-snug flex-1 break-words">{message}</span>
      <button
        onClick={onDismiss}
        aria-label="Dismiss error"
        className="text-muted hover:text-text text-sm leading-none px-1"
      >
        ×
      </button>
    </div>
  );
}
