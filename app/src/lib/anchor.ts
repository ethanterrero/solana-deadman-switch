import { BN } from "@coral-xyz/anchor";
import { LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import type { DmProgram } from "../hooks/useProgram";
import { deriveSwitchPda } from "./pda";

/** Decoded `Switch` account (camelCase, as Anchor returns it). */
export interface SwitchAccount {
  owner: PublicKey;
  beneficiary: PublicKey;
  lastCheckin: BN;
  interval: BN;
  amount: BN;
  bump: number;
}

/** UI-friendly view derived from a raw `SwitchAccount`. */
export interface SwitchView {
  owner: string;
  beneficiary: string;
  amountSol: number;
  intervalSecs: number;
  intervalDays: number;
  lastCheckinMs: number;
  unlockAtMs: number;
}

export function toView(s: SwitchAccount): SwitchView {
  const intervalSecs = s.interval.toNumber();
  const lastCheckinMs = s.lastCheckin.toNumber() * 1000;
  return {
    owner: s.owner.toBase58(),
    beneficiary: s.beneficiary.toBase58(),
    amountSol: s.amount.toNumber() / LAMPORTS_PER_SOL,
    intervalSecs,
    intervalDays: Math.round(intervalSecs / 86400),
    lastCheckinMs,
    unlockAtMs: lastCheckinMs + intervalSecs * 1000,
  };
}

/** Fetch a switch by owner pubkey. Returns null if the PDA doesn't exist yet. */
export async function fetchSwitch(
  program: DmProgram,
  owner: PublicKey,
): Promise<SwitchAccount | null> {
  const [pda] = deriveSwitchPda(owner);
  try {
    return (await program.account.switch.fetch(pda)) as unknown as SwitchAccount;
  } catch {
    return null;
  }
}

// ---- Instructions ----------------------------------------------------------
// Each returns the confirmed transaction signature.

export function initialize(
  program: DmProgram,
  owner: PublicKey,
  beneficiary: PublicKey,
  intervalSecs: number,
  amountSol: number,
): Promise<string> {
  const [switchPda] = deriveSwitchPda(owner);
  return program.methods
    .initialize(
      beneficiary,
      new BN(intervalSecs),
      new BN(Math.round(amountSol * LAMPORTS_PER_SOL)),
    )
    .accountsPartial({ switch: switchPda, owner, systemProgram: SystemProgram.programId })
    .rpc();
}

export function checkIn(program: DmProgram, owner: PublicKey): Promise<string> {
  const [switchPda] = deriveSwitchPda(owner);
  return program.methods
    .checkIn()
    .accountsPartial({ switch: switchPda, owner })
    .rpc();
}

export function deposit(
  program: DmProgram,
  owner: PublicKey,
  amountSol: number,
): Promise<string> {
  const [switchPda] = deriveSwitchPda(owner);
  return program.methods
    .deposit(new BN(Math.round(amountSol * LAMPORTS_PER_SOL)))
    .accountsPartial({ switch: switchPda, owner, systemProgram: SystemProgram.programId })
    .rpc();
}

export function updateConfig(
  program: DmProgram,
  owner: PublicKey,
  newBeneficiary: PublicKey | null,
  newIntervalSecs: number | null,
): Promise<string> {
  const [switchPda] = deriveSwitchPda(owner);
  return program.methods
    .updateConfig(newBeneficiary, newIntervalSecs == null ? null : new BN(newIntervalSecs))
    .accountsPartial({ switch: switchPda, owner })
    .rpc();
}

export function cancel(program: DmProgram, owner: PublicKey): Promise<string> {
  const [switchPda] = deriveSwitchPda(owner);
  return program.methods
    .cancel()
    .accountsPartial({ switch: switchPda, owner })
    .rpc();
}

/**
 * `claim` is signed by the beneficiary, but the PDA is seeded on the *owner*.
 * The beneficiary supplies the owner's address (they looked the vault up by it).
 */
export function claim(
  program: DmProgram,
  ownerPubkey: PublicKey,
  beneficiary: PublicKey,
): Promise<string> {
  const [switchPda] = deriveSwitchPda(ownerPubkey);
  return program.methods
    .claim()
    .accountsPartial({ switch: switchPda, beneficiary })
    .rpc();
}

/** Turn an Anchor/wallet error into a short, human-readable string. */
export function txErrorMessage(e: unknown): string {
  if (!e) return "Unknown error";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const any = e as any;
  const raw: string = any?.message ?? String(e);
  if (/user rejected|rejected the request|user denied/i.test(raw)) {
    return "Transaction rejected in wallet";
  }
  // AnchorError surfaces the program's #[msg(...)] here
  if (any?.error?.errorMessage) return any.error.errorMessage;
  // Common program guards, matched from logs/message as a fallback
  if (/StillActive/i.test(raw)) return "Still active — the interval hasn't elapsed yet";
  if (/Unauthorized/i.test(raw)) return "This wallet isn't authorized for that action";
  if (/insufficient/i.test(raw)) return "Insufficient SOL for this transaction";
  if (/already in use|already exists/i.test(raw)) return "A vault already exists for this wallet";
  return raw.length > 180 ? raw.slice(0, 180) + "…" : raw;
}

/** Solana explorer URL for a tx signature (devnet). */
export function explorerTx(sig: string): string {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}

/** Solana explorer URL for an address (devnet). */
export function explorerAddr(addr: string): string {
  return `https://explorer.solana.com/address/${addr}?cluster=devnet`;
}
