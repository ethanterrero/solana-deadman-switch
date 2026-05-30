import { PublicKey } from "@solana/web3.js";

/** The deployed devnet program ID — keep in sync with declare_id! + Anchor.toml. */
export const PROGRAM_ID = new PublicKey(
  "6gbTnghr3AXPbCTjieq3veCmt656ALbEd7VUGX9z5fFu",
);

/**
 * Derive the Switch PDA for an owner.
 * Matches the on-chain seeds: [b"switch", owner.key().as_ref()].
 */
export function deriveSwitchPda(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("switch"), owner.toBuffer()],
    PROGRAM_ID,
  );
}
