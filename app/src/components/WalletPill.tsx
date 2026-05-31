import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { useEffect, useState } from "react";
import { shortAddr } from "../lib/format";

interface Props {
  role?: "OWNER" | "BENEFICIARY";
}

/**
 * Wallet pill — shows pubkey + live SOL balance, or "CONNECT" when disconnected.
 * Uses the wallet-adapter modal for connect. Polls balance every 15s.
 */
export function WalletPill({ role }: Props) {
  const { publicKey, connected, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const [balanceSol, setBalanceSol] = useState<number | null>(null);

  useEffect(() => {
    if (!publicKey) {
      setBalanceSol(null);
      return;
    }
    const conn = new Connection(clusterApiUrl("devnet"), "confirmed");
    let cancelled = false;
    const fetchBalance = async () => {
      try {
        const lamports = await conn.getBalance(publicKey);
        if (!cancelled) setBalanceSol(lamports / 1e9);
      } catch {
        if (!cancelled) setBalanceSol(null);
      }
    };
    fetchBalance();
    const id = setInterval(fetchBalance, 15_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [publicKey]);

  if (!connected || !publicKey) {
    return (
      <button
        onClick={() => setVisible(true)}
        className="font-mono uppercase tracking-[0.18em] text-xs px-3.5 py-2.5 border border-green text-green bg-transparent hover:bg-green hover:text-black transition-all duration-200 min-h-[44px]"
      >
        CONNECT WALLET ▶
      </button>
    );
  }

  return (
    <div className="inline-flex items-center gap-2.5 px-3 py-2 bg-panel border border-border">
      <span className="w-1.5 h-1.5 rounded-full bg-green shadow-[0_0_8px_var(--green)]" />
      {role && (
        <>
          <span className="stamp text-text">{role}</span>
          <span className="text-xs text-muted">·</span>
        </>
      )}
      <span className="text-xs">{shortAddr(publicKey.toBase58())}</span>
      <span className="text-xs text-muted">·</span>
      <span className="text-xs text-green glow-green tabular">
        {balanceSol == null ? "…" : balanceSol.toFixed(2)} SOL
      </span>
      <button
        onClick={() => disconnect()}
        className="ml-1 text-[10px] text-muted hover:text-text uppercase tracking-widest"
        aria-label="Disconnect wallet"
      >
        ×
      </button>
    </div>
  );
}
