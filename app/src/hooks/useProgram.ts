import { useMemo } from "react";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import idl from "../idl/deadman_switch.json";
import type { DeadmanSwitch } from "../idl/deadman_switch";

export type DmProgram = Program<DeadmanSwitch>;

// A read-only stand-in so account fetches work before a wallet connects.
// Any attempt to actually sign throws — write paths must check `hasSigner`.
const READONLY_WALLET = {
  publicKey: PublicKey.default,
  signTransaction<T extends Transaction | VersionedTransaction>(): Promise<T> {
    return Promise.reject(new Error("Wallet not connected"));
  },
  signAllTransactions<T extends Transaction | VersionedTransaction>(): Promise<T[]> {
    return Promise.reject(new Error("Wallet not connected"));
  },
};

/**
 * Returns a typed Anchor `Program` for the dead man's switch.
 *
 * Always non-null so read paths (`program.account.switch.fetch`) work even
 * before connect; `hasSigner` tells write paths whether `.rpc()` will succeed.
 */
export function useProgram(): { program: DmProgram; hasSigner: boolean } {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  return useMemo(() => {
    const provider = new AnchorProvider(
      connection,
      wallet ?? READONLY_WALLET,
      { commitment: "confirmed" },
    );
    const program = new Program(idl as DeadmanSwitch, provider);
    return { program, hasSigner: !!wallet };
  }, [connection, wallet]);
}
