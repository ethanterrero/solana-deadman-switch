import { useEffect, useRef } from "react";
import { decomposeRemaining, pad2 } from "../lib/format";
import { useCountdown } from "../hooks/useCountdown";

interface Props {
  /** Absolute unlock time in ms; pass null to freeze at 00:00:00:00. */
  unlockAtMs: number | null;
  /** Fires once when the countdown crosses to 0. */
  onExpire?: () => void;
}

/**
 * Drift-free countdown — recomputes from Date.now() each tick rather than
 * decrementing a counter. The SS digit gets a brief flash animation each
 * time the value changes.
 */
export function Countdown({ unlockAtMs, onExpire }: Props) {
  const { remainingSec } = useCountdown(unlockAtMs);
  const { days, hours, mins, secs } = decomposeRemaining(remainingSec);

  const secRef = useRef<HTMLDivElement>(null);
  const lastSec = useRef<number>(-1);

  useEffect(() => {
    if (secs !== lastSec.current) {
      const el = secRef.current;
      if (el) {
        el.classList.remove("tick");
        // force reflow → re-trigger animation
        void el.offsetWidth;
        el.classList.add("tick");
      }
      lastSec.current = secs;
    }
  }, [secs]);

  const firedRef = useRef(false);
  useEffect(() => {
    if (unlockAtMs == null) return;
    if (remainingSec <= 0 && !firedRef.current) {
      firedRef.current = true;
      onExpire?.();
    }
    if (remainingSec > 0) firedRef.current = false;
  }, [remainingSec, unlockAtMs, onExpire]);

  const Cell = ({
    value,
    label,
    innerRef,
  }: {
    value: string;
    label: string;
    innerRef?: React.Ref<HTMLDivElement>;
  }) => (
    <div className="flex flex-col items-center min-w-[1.5em]">
      <div ref={innerRef} className="cd-digit">
        {value}
      </div>
      <div className="text-[0.7rem] tracking-[0.32em] uppercase text-muted mt-3">
        {label}
      </div>
    </div>
  );

  const Sep = () => <div className="cd-sep">:</div>;

  return (
    <div className="flex items-start justify-center gap-1.5">
      <Cell value={pad2(days)} label="DAYS" />
      <Sep />
      <Cell value={pad2(hours)} label="HRS" />
      <Sep />
      <Cell value={pad2(mins)} label="MIN" />
      <Sep />
      <Cell value={pad2(secs)} label="SEC" innerRef={secRef} />
    </div>
  );
}
