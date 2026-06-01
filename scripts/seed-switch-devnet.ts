// Seeds a single live Switch on devnet for fast resets between demo rehearsals
// (and originally, for testing the reminder notifier window).
//
// Inits a switch owned by the provider wallet. Cancels any pre-existing switch
// on the same PDA first (PDA is seeded on the owner, so there's one slot).
//
// Env:
//   BENEFICIARY_PUBKEY   (optional) — base58 pubkey to set as beneficiary. If
//                        omitted, generates a random throwaway (NOT claimable
//                        without the privkey — fine for warming a switch but
//                        useless for a real claim demo).
//   INTERVAL_SECONDS     (optional, default 600) — check-in interval. Set to
//                        60 for live-demo rehearsal so the countdown elapses
//                        fast.
//   AMOUNT_SOL           (optional, default 0.02) — lamports to deposit.
//
// Run:
//   ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
//   ANCHOR_WALLET=$HOME/.config/solana/id.json \
//   BENEFICIARY_PUBKEY=<your-other-phantom-account-pubkey> \
//   INTERVAL_SECONDS=60 \
//   npx ts-mocha -p ./tsconfig.json -t 1000000 scripts/seed-switch-devnet.ts
import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import { DeadmanSwitch } from "../target/types/deadman_switch";

const INTERVAL = parseInt(process.env.INTERVAL_SECONDS || "600", 10);
const AMOUNT_SOL = parseFloat(process.env.AMOUNT_SOL || "0.02");
const BENEFICIARY_ENV = process.env.BENEFICIARY_PUBKEY?.trim();

describe("seed devnet switch", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.deadmanSwitch as Program<DeadmanSwitch>;
  const connection = provider.connection;

  it("inits a fresh switch and prints its coordinates", async () => {
    const owner = provider.wallet.publicKey;
    const beneficiary = BENEFICIARY_ENV
      ? new anchor.web3.PublicKey(BENEFICIARY_ENV)
      : anchor.web3.Keypair.generate().publicKey;
    const amountLamports = Math.round(AMOUNT_SOL * anchor.web3.LAMPORTS_PER_SOL);
    const pda = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("switch"), owner.toBuffer()],
      program.programId
    )[0];

    // If a switch already occupies this PDA, cancel it (owner-only) to free the slot.
    const existing = await connection.getAccountInfo(pda);
    if (existing) {
      await program.methods
        .cancel()
        .accounts({ switch: pda, owner })
        .rpc();
      console.log("  cancelled pre-existing switch on this PDA");
    }

    const sig = await program.methods
      .initialize(beneficiary, new anchor.BN(INTERVAL), new anchor.BN(amountLamports))
      .accounts({ switch: pda, owner })
      .rpc();

    const acct = await program.account.switch.fetch(pda);
    const unlock = acct.lastCheckin.toNumber() + acct.interval.toNumber();

    console.log("\n  ===== SWITCH SEEDED =====");
    console.log("  switch_pda:  ", pda.toBase58());
    console.log("  owner_pubkey:", owner.toBase58());
    console.log("  beneficiary: ", beneficiary.toBase58());
    if (!BENEFICIARY_ENV) {
      console.log("  ⚠ random beneficiary — not claimable. Set BENEFICIARY_PUBKEY for demo runs.");
    }
    console.log("  interval:    ", acct.interval.toNumber(), "s");
    console.log("  amount:      ", AMOUNT_SOL, "SOL");
    console.log("  last_checkin:", acct.lastCheckin.toNumber());
    console.log("  unlocks_at:  ", unlock, `(${new Date(unlock * 1000).toISOString()})`);
    console.log("  init tx:      https://explorer.solana.com/tx/" + sig + "?cluster=devnet");
    console.log("  =========================\n");
  });
});
