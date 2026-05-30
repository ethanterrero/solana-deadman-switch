import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import { DeadmanSwitch } from "../target/types/deadman_switch";
import { assert } from "chai";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("deadman-switch", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.deadmanSwitch as Program<DeadmanSwitch>;
  const connection = provider.connection;

  const INTERVAL = 6; // seconds
  const AMOUNT = 0.1 * anchor.web3.LAMPORTS_PER_SOL;

  // Fresh owner per test so each gets its own Switch PDA (seeded on owner).
  const freshOwner = async () => {
    const kp = anchor.web3.Keypair.generate();
    const sig = await connection.requestAirdrop(
      kp.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(sig, "confirmed");
    return kp;
  };

  before(async () => {
    // Provider wallet is the default fee payer for every rpc(); fund it.
    const sig = await connection.requestAirdrop(
      provider.wallet.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(sig, "confirmed");
  });

  const switchPda = (owner: anchor.web3.PublicKey) =>
    anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("switch"), owner.toBuffer()],
      program.programId
    )[0];

  const initialize = async (
    owner: anchor.web3.Keypair,
    beneficiary: anchor.web3.PublicKey
  ) => {
    const pda = switchPda(owner.publicKey);
    await program.methods
      .initialize(beneficiary, new anchor.BN(INTERVAL), new anchor.BN(AMOUNT))
      .accounts({ switch: pda, owner: owner.publicKey })
      .signers([owner])
      .rpc();
    return pda;
  };

  it("happy path: init -> check_in -> claim blocked -> wait -> claim", async () => {
    const owner = await freshOwner();
    const beneficiary = anchor.web3.Keypair.generate();
    const pda = await initialize(owner, beneficiary.publicKey);

    const acct = await program.account.switch.fetch(pda);
    assert.ok(acct.owner.equals(owner.publicKey));
    assert.ok(acct.beneficiary.equals(beneficiary.publicKey));
    assert.equal(acct.interval.toNumber(), INTERVAL);

    await program.methods
      .checkIn()
      .accounts({ switch: pda, owner: owner.publicKey })
      .signers([owner])
      .rpc();

    // Claim before interval elapses -> StillActive.
    try {
      await program.methods
        .claim()
        .accounts({ switch: pda, beneficiary: beneficiary.publicKey })
        .signers([beneficiary])
        .rpc();
      assert.fail("claim should have reverted with StillActive");
    } catch (e) {
      assert.include(e.toString(), "StillActive");
    }

    await sleep((INTERVAL + 2) * 1000);

    const before = await connection.getBalance(beneficiary.publicKey);
    await program.methods
      .claim()
      .accounts({ switch: pda, beneficiary: beneficiary.publicKey })
      .signers([beneficiary])
      .rpc();
    const after = await connection.getBalance(beneficiary.publicKey);

    assert.isAbove(after, before + AMOUNT - 10000); // deposit + rent, minus fee
    const closed = await connection.getAccountInfo(pda);
    assert.isNull(closed);
  });

  it("claim reverts with StillActive before the interval", async () => {
    const owner = await freshOwner();
    const beneficiary = anchor.web3.Keypair.generate();
    const pda = await initialize(owner, beneficiary.publicKey);

    try {
      await program.methods
        .claim()
        .accounts({ switch: pda, beneficiary: beneficiary.publicKey })
        .signers([beneficiary])
        .rpc();
      assert.fail("expected StillActive");
    } catch (e) {
      assert.include(e.toString(), "StillActive");
    }
  });

  it("claim reverts if caller is not the beneficiary", async () => {
    const owner = await freshOwner();
    const beneficiary = anchor.web3.Keypair.generate();
    const pda = await initialize(owner, beneficiary.publicKey);

    await sleep((INTERVAL + 2) * 1000);

    const imposter = await freshOwner();
    try {
      await program.methods
        .claim()
        .accounts({ switch: pda, beneficiary: imposter.publicKey })
        .signers([imposter])
        .rpc();
      assert.fail("expected Unauthorized");
    } catch (e) {
      assert.include(e.toString(), "Unauthorized");
    }
  });

  it("check_in reverts if caller is not the owner", async () => {
    const owner = await freshOwner();
    const beneficiary = anchor.web3.Keypair.generate();
    const pda = await initialize(owner, beneficiary.publicKey);

    const imposter = await freshOwner();
    try {
      await program.methods
        .checkIn()
        .accounts({ switch: pda, owner: imposter.publicKey })
        .signers([imposter])
        .rpc();
      assert.fail("expected check_in by non-owner to revert");
    } catch (e) {
      // CheckIn's PDA is seeded on the signer, so a non-owner derives a
      // different address than the real switch and the seeds guard rejects it.
      assert.include(e.toString(), "ConstraintSeeds");
    }
  });

  it("cancel returns funds to owner and blocks a later claim", async () => {
    const owner = await freshOwner();
    const beneficiary = anchor.web3.Keypair.generate();
    const pda = await initialize(owner, beneficiary.publicKey);

    const before = await connection.getBalance(owner.publicKey);
    await program.methods
      .cancel()
      .accounts({ switch: pda, owner: owner.publicKey })
      .signers([owner])
      .rpc();
    const after = await connection.getBalance(owner.publicKey);
    assert.isAbove(after, before); // got deposit + rent back

    const closed = await connection.getAccountInfo(pda);
    assert.isNull(closed);

    // Switch is gone, so a later claim cannot resolve the account.
    await sleep((INTERVAL + 2) * 1000);
    try {
      await program.methods
        .claim()
        .accounts({ switch: pda, beneficiary: beneficiary.publicKey })
        .signers([beneficiary])
        .rpc();
      assert.fail("claim should fail against a cancelled switch");
    } catch (e) {
      assert.ok(e); // account does not exist
    }
  });
});
