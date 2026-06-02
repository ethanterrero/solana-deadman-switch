// Seeds (or resets) a single live Switch on devnet for fast demo rehearsals.
//
// Plain ESM — runs with `node`, no Anchor CLI / ts-mocha / TS runner needed.
// Resolves @coral-xyz/anchor + @solana/web3.js from app/node_modules, so run it
// from the repo root after `npm install --prefix app` has been done once.
//
// The Switch PDA is seeded on the owner ([b"switch", owner]), so there's exactly
// one slot per owner. If one already exists this cancels it first, then inits a
// fresh one — leaving on-chain state clean for the next run.
//
// Env:
//   RPC_URL            (optional) RPC endpoint. Default: api.devnet.solana.com.
//                      Use your Helius URL to match the app for rehearsals.
//   KEYPAIR            (optional) path to the owner keypair JSON.
//                      Default: ~/.config/solana/id.json
//   BENEFICIARY_PUBKEY (recommended) base58 pubkey set as beneficiary. If omitted,
//                      a random throwaway is used — warms a switch but is NOT
//                      claimable (no privkey). Set it for a real claim demo.
//   INTERVAL_SECONDS   (optional, default 30) check-in interval. 30 = fast demo.
//   AMOUNT_SOL         (optional, default 0.1) SOL to lock in the vault.
//
// Run (from repo root):
//   BENEFICIARY_PUBKEY=<beneficiary-pubkey> \
//   RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_KEY \
//   node app/scripts/seed-switch.mjs
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import anchor from "@coral-xyz/anchor";
import web3 from "@solana/web3.js";

const { AnchorProvider, Program, Wallet, BN } = anchor;
const { Connection, Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } = web3;

const RPC_URL = process.env.RPC_URL?.trim() || "https://api.devnet.solana.com";
const KEYPAIR_PATH =
  process.env.KEYPAIR?.trim() || resolve(homedir(), ".config/solana/id.json");
const INTERVAL = parseInt(process.env.INTERVAL_SECONDS || "30", 10);
const AMOUNT_SOL = parseFloat(process.env.AMOUNT_SOL || "0.1");
const BENEFICIARY_ENV = process.env.BENEFICIARY_PUBKEY?.trim();

const here = dirname(fileURLToPath(import.meta.url));
const idl = JSON.parse(
  readFileSync(resolve(here, "../src/idl/deadman_switch.json"), "utf8"),
);

function loadKeypair(path) {
  const bytes = JSON.parse(readFileSync(path, "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(bytes));
}

async function main() {
  const connection = new Connection(RPC_URL, "confirmed");
  const ownerKp = loadKeypair(KEYPAIR_PATH);
  const provider = new AnchorProvider(connection, new Wallet(ownerKp), {
    commitment: "confirmed",
  });
  const program = new Program(idl, provider);

  const owner = ownerKp.publicKey;
  const beneficiary = BENEFICIARY_ENV
    ? new PublicKey(BENEFICIARY_ENV)
    : Keypair.generate().publicKey;
  const amountLamports = Math.round(AMOUNT_SOL * LAMPORTS_PER_SOL);
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("switch"), owner.toBuffer()],
    program.programId,
  );

  const bal = await connection.getBalance(owner);
  console.log(`\n  owner ${owner.toBase58()} · ${(bal / LAMPORTS_PER_SOL).toFixed(4)} SOL · ${RPC_URL}`);
  if (bal < amountLamports + 0.01 * LAMPORTS_PER_SOL) {
    console.warn(
      `  ⚠ low balance — need ~${AMOUNT_SOL + 0.01} SOL to init. Airdrop: solana airdrop 2 ${owner.toBase58()} --url devnet`,
    );
  }

  // Free the PDA slot if a switch already lives there.
  const existing = await connection.getAccountInfo(pda);
  if (existing) {
    const sig = await program.methods
      .cancel()
      .accountsPartial({ switch: pda, owner })
      .rpc();
    console.log(`  cancelled pre-existing switch (${sig.slice(0, 8)}…)`);
  }

  const sig = await program.methods
    .initialize(beneficiary, new BN(INTERVAL), new BN(amountLamports))
    .accountsPartial({ switch: pda, owner, systemProgram: SystemProgram.programId })
    .rpc();

  const acct = await program.account.switch.fetch(pda);
  const unlock = acct.lastCheckin.toNumber() + acct.interval.toNumber();

  console.log("\n  ===== SWITCH SEEDED =====");
  console.log("  switch_pda:  ", pda.toBase58());
  console.log("  owner_pubkey:", owner.toBase58());
  console.log("  beneficiary: ", beneficiary.toBase58());
  if (!BENEFICIARY_ENV) {
    console.log("  ⚠ random beneficiary — NOT claimable. Set BENEFICIARY_PUBKEY for a claim demo.");
  }
  console.log("  interval:    ", acct.interval.toNumber(), "s");
  console.log("  amount:      ", AMOUNT_SOL, "SOL");
  console.log("  unlocks_at:  ", unlock, `(${new Date(unlock * 1000).toISOString()})`);
  console.log("  in ~" + (unlock - Math.floor(Date.now() / 1000)) + "s from now");
  console.log("  init tx:      https://explorer.solana.com/tx/" + sig + "?cluster=devnet");
  console.log("  =========================\n");
}

main().catch((e) => {
  console.error("\n  seed failed:", e?.message || e);
  process.exit(1);
});
