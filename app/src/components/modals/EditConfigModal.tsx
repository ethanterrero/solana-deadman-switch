import { useMemo, useState } from "react";
import { Modal } from "../Modal";
import { Field, FieldLabel } from "../Field";
import { Button } from "../Button";
import { fmtSeconds, fmtUtc, shortAddr } from "../../lib/format";
import { MAX_INTERVAL_SECS, MIN_INTERVAL_SECS } from "../../lib/anchor";

interface Props {
  open: boolean;
  onClose: () => void;
  currentBeneficiary: string;
  currentIntervalDays: number;
  lastCheckinMs: number;
  nowMs: number;
  onSave: (newBeneficiary?: string, newIntervalDays?: number) => void;
}

export function EditConfigModal({
  open,
  onClose,
  currentBeneficiary,
  currentIntervalDays,
  lastCheckinMs,
  nowMs,
  onSave,
}: Props) {
  const [newBen, setNewBen] = useState("");
  const [newInt, setNewInt] = useState<string>("");

  const intervalNum = parseInt(newInt);
  // Mirrors the on-chain MIN_INTERVAL / MAX_INTERVAL check.
  const outOfRange =
    !!intervalNum &&
    (intervalNum * 86400 < MIN_INTERVAL_SECS || intervalNum * 86400 > MAX_INTERVAL_SECS);
  const preview = useMemo(() => {
    if (!intervalNum || intervalNum <= 0) return null;
    const unlockTs = lastCheckinMs + intervalNum * 86400 * 1000;
    const wouldBeClaimable = unlockTs <= nowMs;
    const deltaDays = (unlockTs - nowMs) / 86400000;
    return {
      unlockTs,
      wouldBeClaimable,
      deltaDays,
    };
  }, [intervalNum, lastCheckinMs, nowMs]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      titleId="m-config-title"
      tag={
        <>
          <span className="text-green">▸</span> ix · update_config()
        </>
      }
      title={<>EDIT VAULT CONFIG</>}
      subtitle={
        <>
          change the beneficiary, interval, or both. leave a field blank to keep
          the current value. last_checkin and amount are untouched.
        </>
      }
      footer={
        <>
          <Button onClick={onClose}>CANCEL</Button>
          <Button
            variant="primary"
            disabled={outOfRange}
            onClick={() => onSave(newBen || undefined, intervalNum || undefined)}
          >
            ▸ SAVE CONFIG
          </Button>
        </>
      }
    >
      <div>
        <FieldLabel>
          NEW BENEFICIARY PUBKEY (CURRENT: {shortAddr(currentBeneficiary)})
        </FieldLabel>
        <Field
          autoFocus
          placeholder="leave blank to keep current"
          value={newBen}
          onChange={(e) => setNewBen(e.target.value)}
        />
      </div>
      <div>
        <FieldLabel>
          NEW INTERVAL · DAYS (CURRENT: {currentIntervalDays})
        </FieldLabel>
        <Field
          type="number"
          min={1}
          placeholder="leave blank to keep current"
          value={newInt}
          onChange={(e) => setNewInt(e.target.value)}
        />
        {outOfRange && (
          <div className="mt-2 text-red text-xs">
            interval must be between {fmtSeconds(MIN_INTERVAL_SECS)} and{" "}
            {fmtSeconds(MAX_INTERVAL_SECS)}.
          </div>
        )}
        {preview && !outOfRange && (
          <div
            className={`mt-2.5 px-3.5 py-2.5 bg-panel-2 border font-mono text-xs leading-relaxed ${
              preview.wouldBeClaimable
                ? "border-border border-l-2 border-l-red"
                : "border-border border-l-2 border-l-green"
            }`}
          >
            <span className="text-muted tracking-wider uppercase text-[0.65rem]">
              NEW UNLOCK_AT:
            </span>
            <span
              className={`ml-2 font-semibold ${
                preview.wouldBeClaimable ? "text-red" : "text-green"
              }`}
            >
              {fmtUtc(preview.unlockTs)}
            </span>
            <span className="text-muted ml-2 text-[0.7rem]">
              {preview.wouldBeClaimable
                ? `${Math.abs(preview.deltaDays).toFixed(1)} days in the past`
                : `${preview.deltaDays.toFixed(1)} days from now`}
            </span>
            {preview.wouldBeClaimable && (
              <span className="block mt-1.5 text-red text-[0.72rem]">
                ⚠ beneficiary could start a claim IMMEDIATELY after save — CHECK_IN before changing.
              </span>
            )}
          </div>
        )}
      </div>
      <div className="bg-amber/[.06] border border-amber/30 border-l-2 border-l-amber px-3.5 py-3 text-xs leading-relaxed text-muted">
        <strong className="text-amber">⚠ careful:</strong> if you shorten the
        interval below (now − last_checkin), your beneficiary could start a
        claim immediately. consider CHECK_IN first if you're unsure.
      </div>
    </Modal>
  );
}
