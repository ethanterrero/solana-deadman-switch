// Prints the current on-chain state of a Switch PDA — read-only, no signing.
// Use during rehearsal to confirm what the chain actually holds.
//
// Env:
//   RPC_URL       (optional) RPC endpoint. Default: api.devnet.solana.com.
//   OWNER_PUBKEY  (optional) owner whose switch to inspect. Default: the pubkey
//                 of ~/.config/solana/id.json (or KEYPAIR).
//   KEYPAIR       (optional) path to a keypair to derive the owner from.
//
// Run (from repo root):
//   OWNER_PUBKEY=<owner-pubkey> node app/scripts/switch-state.mjs
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import anchor from "@coral-xyz/anchor";
import web3 from "@solana/web3.js";

const { AnchorProvider, Program, Wallet } = anchor;
const { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } = web3;

const RPC_URL = process.env.RPC_URL?.trim() || "https://api.devnet.solana.com";
const KEYPAIR_PATH =
  process.env.KEYPAIR?.trim() || resolve(homedir(), ".config/solana/id.json");

const here = dirname(fileURLToPath(import.meta.url));
const idl = JSON.parse(
  readFileSync(resolve(here, "../src/idl/deadman_switch.json"), "utf8"),
);

function loadKeypair(path) {
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, "utf8"))));
}

async function main() {
  const connection = new Connection(RPC_URL, "confirmed");
  const owner = process.env.OWNER_PUBKEY?.trim()
    ? new PublicKey(process.env.OWNER_PUBKEY.trim())
    : loadKeypair(KEYPAIR_PATH).publicKey;

  // Read-only provider — we never sign here.
  const provider = new AnchorProvider(connection, new Wallet(Keypair.generate()), {
    commitment: "confirmed",
  });
  const program = new Program(idl, provider);
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("switch"), owner.toBuffer()],
    program.programId,
  );

  console.log(`\n  owner:      ${owner.toBase58()}`);
  console.log(`  switch_pda: ${pda.toBase58()}`);
  console.log(`  rpc:        ${RPC_URL}`);

  const info = await connection.getAccountInfo(pda);
  if (!info) {
    console.log("\n  STATE: no switch (PDA empty) — ready for a fresh initialize.\n");
    return;
  }

  const acct = await program.account.switch.fetch(pda);
  const now = Math.floor(Date.now() / 1000);
  const unlock = acct.lastCheckin.toNumber() + acct.interval.toNumber();
  const remaining = unlock - now;
  const claimable = remaining <= 0;

  console.log("\n  STATE: switch EXISTS");
  console.log(`  beneficiary: ${acct.beneficiary.toBase58()}`);
  console.log(`  amount:      ${(acct.amount.toNumber() / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log(`  interval:    ${acct.interval.toNumber()} s`);
  console.log(`  unlocks_at:  ${unlock} (${new Date(unlock * 1000).toISOString()})`);
  if (claimable) {
    console.log(`  >>> CLAIMABLE NOW (elapsed ${-remaining}s ago)\n`);
  } else {
    console.log(`  >>> LOCKED — claimable in ${remaining}s\n`);
  }
}

main().catch((e) => {
  console.error("\n  state check failed:", e?.message || e);
  process.exit(1);
});
