// Devnet smoke test: drives the full core lifecycle against the LIVE program.
// Run with:
//   ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
//   ANCHOR_WALLET=~/.config/solana/id.json \
//   npx ts-mocha -p ./tsconfig.json -t 1000000 scripts/smoke-devnet.ts
//
// The owner wallet (provider) pays all fees, so the ephemeral beneficiary
// needs no SOL — it only signs start_claim/claim and receives the closed PDA's
// lamports. Expects the devnet program to be a `demo`-feature build
// (MIN_INTERVAL = 5s, CHALLENGE_PERIOD = 10s).
import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import { DeadmanSwitch } from "../target/types/deadman_switch";
import { assert } from "chai";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ex = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;

describe("devnet smoke", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.deadmanSwitch as Program<DeadmanSwitch>;
  const connection = provider.connection;

  const INTERVAL = 10;
  const CHALLENGE = 10;
  const AMOUNT = 0.02 * anchor.web3.LAMPORTS_PER_SOL;

  it("init -> check_in -> start_claim blocked -> wait -> start_claim -> challenge -> claim (on devnet)", async () => {
    const owner = provider.wallet.publicKey;
    const beneficiary = anchor.web3.Keypair.generate();
    const pda = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("switch"), owner.toBuffer()],
      program.programId
    )[0];

    console.log("  program:    ", program.programId.toBase58());
    console.log("  owner:      ", owner.toBase58());
    console.log("  beneficiary:", beneficiary.publicKey.toBase58());
    console.log("  switch PDA: ", pda.toBase58());

    const initSig = await program.methods
      .initialize(beneficiary.publicKey, new anchor.BN(INTERVAL), new anchor.BN(AMOUNT))
      .accountsPartial({ switch: pda, owner })
      .rpc();
    console.log("  initialize: ", ex(initSig));

    const acct = await program.account.switch.fetch(pda);
    assert.ok(acct.owner.equals(owner));
    assert.ok(acct.beneficiary.equals(beneficiary.publicKey));
    assert.equal(acct.amount.toNumber(), AMOUNT);

    const checkSig = await program.methods
      .checkIn()
      .accountsPartial({ switch: pda, owner })
      .rpc();
    console.log("  check_in:   ", ex(checkSig));

    const startClaim = () =>
      program.methods
        .startClaim()
        .accountsPartial({ switch: pda, beneficiary: beneficiary.publicKey })
        .signers([beneficiary])
        .rpc();

    // start_claim before the interval -> StillActive.
    let blocked = false;
    try {
      await startClaim();
    } catch (e) {
      blocked = e.toString().includes("StillActive");
    }
    assert.ok(blocked, "start_claim should be blocked with StillActive before the interval");
    console.log("  start_claim (early): correctly reverted with StillActive");

    console.log(`  waiting ${INTERVAL + 4}s for the interval to elapse...`);
    await sleep((INTERVAL + 4) * 1000);

    const startSig = await startClaim();
    console.log("  start_claim:", ex(startSig));

    console.log(`  waiting ${CHALLENGE + 4}s for the challenge window to close...`);
    await sleep((CHALLENGE + 4) * 1000);

    const benBefore = await connection.getBalance(beneficiary.publicKey);
    const claimSig = await program.methods
      .claim()
      .accountsPartial({ switch: pda, beneficiary: beneficiary.publicKey })
      .signers([beneficiary])
      .rpc();
    console.log("  claim:      ", ex(claimSig));
    const benAfter = await connection.getBalance(beneficiary.publicKey);

    assert.isAbove(benAfter, benBefore, "beneficiary should receive the closed PDA lamports");
    assert.isNull(await connection.getAccountInfo(pda), "switch PDA should be closed");
    console.log(`  beneficiary received ${(benAfter - benBefore) / anchor.web3.LAMPORTS_PER_SOL} SOL; PDA closed`);
  });
});
