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

  it("initialize rejects a non-positive interval", async () => {
    const owner = await freshOwner();
    const beneficiary = anchor.web3.Keypair.generate();
    const pda = switchPda(owner.publicKey);
    try {
      await program.methods
        .initialize(beneficiary.publicKey, new anchor.BN(0), new anchor.BN(AMOUNT))
        .accounts({ switch: pda, owner: owner.publicKey })
        .signers([owner])
        .rpc();
      assert.fail("expected InvalidInterval");
    } catch (e) {
      assert.include(e.toString(), "InvalidInterval");
    }
  });

  it("initialize rejects a zero amount", async () => {
    const owner = await freshOwner();
    const beneficiary = anchor.web3.Keypair.generate();
    const pda = switchPda(owner.publicKey);
    try {
      await program.methods
        .initialize(beneficiary.publicKey, new anchor.BN(INTERVAL), new anchor.BN(0))
        .accounts({ switch: pda, owner: owner.publicKey })
        .signers([owner])
        .rpc();
      assert.fail("expected InvalidAmount");
    } catch (e) {
      assert.include(e.toString(), "InvalidAmount");
    }
  });

  it("initialize rejects a beneficiary equal to the owner", async () => {
    const owner = await freshOwner();
    const pda = switchPda(owner.publicKey);
    try {
      await program.methods
        .initialize(owner.publicKey, new anchor.BN(INTERVAL), new anchor.BN(AMOUNT))
        .accounts({ switch: pda, owner: owner.publicKey })
        .signers([owner])
        .rpc();
      assert.fail("expected InvalidBeneficiary");
    } catch (e) {
      assert.include(e.toString(), "InvalidBeneficiary");
    }
  });

  it("deposit adds funds and is owner-only", async () => {
    const owner = await freshOwner();
    const beneficiary = anchor.web3.Keypair.generate();
    const pda = await initialize(owner, beneficiary.publicKey);

    const topUp = 0.05 * anchor.web3.LAMPORTS_PER_SOL;
    const balBefore = await connection.getBalance(pda);
    await program.methods
      .deposit(new anchor.BN(topUp))
      .accounts({ switch: pda, owner: owner.publicKey })
      .signers([owner])
      .rpc();
    const balAfter = await connection.getBalance(pda);
    assert.equal(balAfter - balBefore, topUp);

    const acct = await program.account.switch.fetch(pda);
    assert.equal(acct.amount.toNumber(), AMOUNT + topUp);

    // Non-owner cannot deposit (seeds derive a different, nonexistent PDA).
    const imposter = await freshOwner();
    try {
      await program.methods
        .deposit(new anchor.BN(topUp))
        .accounts({ switch: pda, owner: imposter.publicKey })
        .signers([imposter])
        .rpc();
      assert.fail("expected non-owner deposit to revert");
    } catch (e) {
      assert.include(e.toString(), "ConstraintSeeds");
    }
  });

  it("update_config changes beneficiary + interval; new beneficiary can claim", async () => {
    const owner = await freshOwner();
    const beneficiary = anchor.web3.Keypair.generate();
    const pda = await initialize(owner, beneficiary.publicKey);

    const newBeneficiary = anchor.web3.Keypair.generate();
    await program.methods
      .updateConfig(newBeneficiary.publicKey, new anchor.BN(INTERVAL))
      .accounts({ switch: pda, owner: owner.publicKey })
      .signers([owner])
      .rpc();

    const acct = await program.account.switch.fetch(pda);
    assert.ok(acct.beneficiary.equals(newBeneficiary.publicKey));

    // Rejects an interval of zero.
    try {
      await program.methods
        .updateConfig(null, new anchor.BN(0))
        .accounts({ switch: pda, owner: owner.publicKey })
        .signers([owner])
        .rpc();
      assert.fail("expected InvalidInterval");
    } catch (e) {
      assert.include(e.toString(), "InvalidInterval");
    }

    // The original beneficiary can no longer claim; the new one can.
    await sleep((INTERVAL + 2) * 1000);
    try {
      await program.methods
        .claim()
        .accounts({ switch: pda, beneficiary: beneficiary.publicKey })
        .signers([beneficiary])
        .rpc();
      assert.fail("old beneficiary should be Unauthorized");
    } catch (e) {
      assert.include(e.toString(), "Unauthorized");
    }
    await program.methods
      .claim()
      .accounts({ switch: pda, beneficiary: newBeneficiary.publicKey })
      .signers([newBeneficiary])
      .rpc();
    assert.isNull(await connection.getAccountInfo(pda));
  });

  it("emits a CheckedIn event on check_in", async () => {
    const owner = await freshOwner();
    const beneficiary = anchor.web3.Keypair.generate();
    const pda = await initialize(owner, beneficiary.publicKey);

    const sig = await program.methods
      .checkIn()
      .accounts({ switch: pda, owner: owner.publicKey })
      .signers([owner])
      .rpc();
    await connection.confirmTransaction(sig, "confirmed");

    const tx = await connection.getTransaction(sig, {
      commitment: "confirmed",
    });
    const parser = new anchor.EventParser(program.programId, program.coder);
    // The parser camelCases event names: `CheckedIn` -> `checkedIn`.
    const events = [...parser.parseLogs(tx.meta.logMessages)];
    const checkedIn = events.find((e) => e.name === "checkedIn");
    assert.ok(checkedIn, "CheckedIn event should be emitted");
    assert.ok(checkedIn.data.owner.equals(owner.publicKey));
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
