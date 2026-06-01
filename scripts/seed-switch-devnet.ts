// Seeds a single live Switch on devnet for testing the reminder notifier.
// Inits a switch owned by the provider wallet with a short interval, so it sits
// inside the reminder warning window immediately. Cancels any pre-existing
// switch on the same PDA first (PDA is seeded on the owner, so there's one slot).
//
// Run:
//   ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
//   ANCHOR_WALLET=$HOME/.config/solana/id.json \
//   npx ts-mocha -p ./tsconfig.json -t 1000000 scripts/seed-switch-devnet.ts
import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import { DeadmanSwitch } from "../target/types/deadman_switch";

const INTERVAL = 600; // 10 min — short enough to be "in window", long enough to inspect
const AMOUNT = 0.02 * anchor.web3.LAMPORTS_PER_SOL;

describe("seed devnet switch", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.deadmanSwitch as Program<DeadmanSwitch>;
  const connection = provider.connection;

  it("inits a fresh switch and prints its coordinates", async () => {
    const owner = provider.wallet.publicKey;
    const beneficiary = anchor.web3.Keypair.generate();
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
      .initialize(beneficiary.publicKey, new anchor.BN(INTERVAL), new anchor.BN(AMOUNT))
      .accounts({ switch: pda, owner })
      .rpc();

    const acct = await program.account.switch.fetch(pda);
    const unlock = acct.lastCheckin.toNumber() + acct.interval.toNumber();

    console.log("\n  ===== SWITCH SEEDED =====");
    console.log("  switch_pda:  ", pda.toBase58());
    console.log("  owner_pubkey:", owner.toBase58());
    console.log("  beneficiary: ", beneficiary.publicKey.toBase58());
    console.log("  interval:    ", acct.interval.toNumber(), "s");
    console.log("  last_checkin:", acct.lastCheckin.toNumber());
    console.log("  unlocks_at:  ", unlock, `(${new Date(unlock * 1000).toISOString()})`);
    console.log("  init tx:      https://explorer.solana.com/tx/" + sig + "?cluster=devnet");
    console.log("  =========================\n");
  });
});
