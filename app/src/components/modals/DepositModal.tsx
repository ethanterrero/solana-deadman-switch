import { useState } from "react";
import { Modal } from "../Modal";
import { Field, FieldLabel } from "../Field";
import { Button } from "../Button";

interface Props {
  open: boolean;
  onClose: () => void;
  currentLocked: number;
  walletBalance: number;
  onDeposit: (sol: number) => void;
}

export function DepositModal({
  open,
  onClose,
  currentLocked,
  walletBalance,
  onDeposit,
}: Props) {
  const [amount, setAmount] = useState(1.0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      titleId="m-deposit-title"
      tag={
        <>
          <span className="text-green">▸</span> ix · deposit()
        </>
      }
      title={<>ADD MORE SOL</>}
      subtitle={
        <>
          the vault PDA can hold any amount. top it up any time — your interval
          and last_checkin are unaffected.
        </>
      }
      footer={
        <>
          <Button onClick={onClose}>CANCEL</Button>
          <Button variant="primary" disabled={amount <= 0} onClick={() => onDeposit(amount)}>
            ▸ DEPOSIT
          </Button>
        </>
      }
    >
      <div className="text-sm text-muted">
        currently locked ·{" "}
        <span className="text-green font-semibold">{currentLocked.toFixed(2)} SOL</span>{" "}
        ·&nbsp; wallet balance ·{" "}
        <span className="text-text font-semibold">
          {walletBalance.toFixed(2)} SOL
        </span>
      </div>
      <div>
        <FieldLabel>AMOUNT TO DEPOSIT (SOL)</FieldLabel>
        <Field
          autoFocus
          type="number"
          step={0.01}
          min={0.01}
          value={amount}
          onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
        />
      </div>
      <div className="flex gap-2 flex-wrap">
        {[0.5, 1.0, 5.0].map((v) => (
          <button
            key={v}
            onClick={() => setAmount(v)}
            className="font-mono font-semibold uppercase text-xs px-3 py-2 border border-border bg-panel-2 text-text hover:border-green hover:text-green min-h-[40px]"
          >
            {v.toFixed(1)}
          </button>
        ))}
        <button
          onClick={() => setAmount(walletBalance - 0.01)}
          className="font-mono font-semibold uppercase text-xs px-3 py-2 border border-amber bg-panel-2 text-amber hover:bg-amber/10 min-h-[40px]"
        >
          MAX
        </button>
      </div>
    </Modal>
  );
}
