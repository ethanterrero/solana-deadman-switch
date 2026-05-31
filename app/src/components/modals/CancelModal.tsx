import { Modal } from "../Modal";
import { Button } from "../Button";

interface Props {
  open: boolean;
  onClose: () => void;
  amountSol: number;
  onConfirm: () => void;
}

export function CancelModal({ open, onClose, amountSol, onConfirm }: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      titleId="m-cancel-title"
      variant="danger"
      tag={
        <span className="text-red">
          ! ix · cancel()
        </span>
      }
      title={<>CANCEL VAULT</>}
      subtitle={
        <>
          this closes the switch PDA and returns{" "}
          <span className="text-text font-semibold">{amountSol.toFixed(2)} SOL</span>{" "}
          to your wallet. the beneficiary's claim window ends immediately. you can
          re-arm later.
        </>
      }
      footer={
        <>
          <Button onClick={onClose}>◀ KEEP VAULT</Button>
          <Button variant="danger" onClick={onConfirm}>
            ▸ I'M SURE · CLOSE
          </Button>
        </>
      }
    >
      <div className="bg-red/[.06] border border-red/30 border-l-2 border-l-red px-3.5 py-3 text-xs leading-relaxed text-muted">
        <strong className="text-red">irreversible:</strong> the Switch account is
        closed on-chain (rent reclaimed) and the{" "}
        <code className="text-red">Cancelled</code> event is emitted. re-arming
        creates a new PDA from scratch.
      </div>
    </Modal>
  );
}
