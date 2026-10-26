import { BN } from "@coral-xyz/anchor";
import { LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import type { DmProgram } from "../hooks/useProgram";
import idl from "../idl/deadman_switch.json";
import { deriveSwitchPda } from "./pda";

// Program bounds, read from the IDL so the UI matches whichever build
// (release or `demo`) is deployed.
function idlConstant(name: string): number {
  const c = (idl as { constants?: { name: string; value: string }[] }).constants?.find(
    (k) => k.name === name,
  );
  if (!c) throw new Error(`IDL is missing constant ${name}`);
  return Number(c.value.replace(/_/g, ""));
}

export const MIN_INTERVAL_SECS = idlConstant("MIN_INTERVAL");
export const MAX_INTERVAL_SECS = idlConstant("MAX_INTERVAL");
export const CHALLENGE_PERIOD_SECS = idlConstant("CHALLENGE_PERIOD");

/** Decoded `Switch` account (camelCase, as Anchor returns it). */
export interface SwitchAccount {
  owner: PublicKey;
  beneficiary: PublicKey;
  lastCheckin: BN;
  interval: BN;
  amount: BN;
  bump: number;
  claimStartedAt: BN;
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
  /** When the beneficiary started a claim; null if none is pending. */
  claimStartedMs: number | null;
  /** When a pending claim can be finished; null if none is pending. */
  claimableAtMs: number | null;
}

export function toView(s: SwitchAccount): SwitchView {
  const intervalSecs = s.interval.toNumber();
  const lastCheckinMs = s.lastCheckin.toNumber() * 1000;
  const claimStartedMs = s.claimStartedAt.isZero() ? null : s.claimStartedAt.toNumber() * 1000;
  return {
    owner: s.owner.toBase58(),
    beneficiary: s.beneficiary.toBase58(),
    amountSol: s.amount.toNumber() / LAMPORTS_PER_SOL,
    intervalSecs,
    intervalDays: Math.round(intervalSecs / 86400),
    lastCheckinMs,
    unlockAtMs: lastCheckinMs + intervalSecs * 1000,
    claimStartedMs,
    claimableAtMs: claimStartedMs == null ? null : claimStartedMs + CHALLENGE_PERIOD_SECS * 1000,
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

/**
 * Find every switch naming `beneficiary` as heir. The beneficiary pubkey sits
 * right after the 8-byte discriminator and 32-byte owner, so a memcmp filter
 * at offset 40 lets the RPC do the search.
 */
export async function fetchSwitchesForBeneficiary(
  program: DmProgram,
  beneficiary: PublicKey,
): Promise<SwitchAccount[]> {
  const found = await program.account.switch.all([
    { memcmp: { offset: 8 + 32, bytes: beneficiary.toBase58() } },
  ]);
  return found.map((f) => f.account as unknown as SwitchAccount);
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
 * `start_claim` and `claim` are signed by the beneficiary, but the PDA is
 * seeded on the *owner*, so the caller passes the owner's address.
 * `start_claim` opens the owner's challenge window; `claim` finishes it.
 */
export function startClaim(
  program: DmProgram,
  ownerPubkey: PublicKey,
  beneficiary: PublicKey,
): Promise<string> {
  const [switchPda] = deriveSwitchPda(ownerPubkey);
  return program.methods
    .startClaim()
    .accountsPartial({ switch: switchPda, beneficiary })
    .rpc();
}

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
  if (/ChallengeWindowOpen/i.test(raw)) return "The owner's challenge window is still open";
  if (/ClaimNotStarted/i.test(raw)) return "No claim is pending — start one first";
  if (/ClaimAlreadyStarted/i.test(raw)) return "A claim is already pending";
  if (/InvalidInterval/i.test(raw)) return "Interval is outside the allowed range";
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
