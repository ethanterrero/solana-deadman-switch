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

  // Requires a `demo`-feature build: MIN_INTERVAL = 5s, CHALLENGE_PERIOD = 10s.
  const INTERVAL = 6; // seconds
  const CHALLENGE = 10; // seconds
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
      .accountsPartial({ switch: pda, owner: owner.publicKey })
      .signers([owner])
      .rpc();
    return pda;
  };

  const startClaim = (pda: anchor.web3.PublicKey, beneficiary: anchor.web3.Keypair) =>
    program.methods
      .startClaim()
      .accountsPartial({ switch: pda, beneficiary: beneficiary.publicKey })
      .signers([beneficiary])
      .rpc();

  const claim = (pda: anchor.web3.PublicKey, beneficiary: anchor.web3.Keypair) =>
    program.methods
      .claim()
      .accountsPartial({ switch: pda, beneficiary: beneficiary.publicKey })
      .signers([beneficiary])
      .rpc();

  const expectError = async (p: Promise<unknown>, code: string) => {
    try {
      await p;
    } catch (e) {
      assert.include(e.toString(), code);
      return;
    }
    assert.fail(`expected ${code}`);
  };

  it("happy path: init -> check_in -> start_claim blocked -> wait -> start_claim -> challenge -> claim", async () => {
    const owner = await freshOwner();
    const beneficiary = anchor.web3.Keypair.generate();
    const pda = await initialize(owner, beneficiary.publicKey);

    const acct = await program.account.switch.fetch(pda);
    assert.ok(acct.owner.equals(owner.publicKey));
    assert.ok(acct.beneficiary.equals(beneficiary.publicKey));
    assert.equal(acct.interval.toNumber(), INTERVAL);
    assert.equal(acct.claimStartedAt.toNumber(), 0);

    await program.methods
      .checkIn()
      .accountsPartial({ switch: pda, owner: owner.publicKey })
      .signers([owner])
      .rpc();

    // Starting a claim before the interval elapses -> StillActive.
    await expectError(startClaim(pda, beneficiary), "StillActive");

    await sleep((INTERVAL + 2) * 1000);
    await startClaim(pda, beneficiary);
    assert.isAbove((await program.account.switch.fetch(pda)).claimStartedAt.toNumber(), 0);

    // Finishing inside the challenge window -> ChallengeWindowOpen.
    await expectError(claim(pda, beneficiary), "ChallengeWindowOpen");

    await sleep((CHALLENGE + 2) * 1000);
    const before = await connection.getBalance(beneficiary.publicKey);
    await claim(pda, beneficiary);
    const after = await connection.getBalance(beneficiary.publicKey);

    assert.isAbove(after, before + AMOUNT - 10000); // deposit + rent, minus fee
    const closed = await connection.getAccountInfo(pda);
    assert.isNull(closed);
  });

  it("claim reverts with ClaimNotStarted if start_claim was skipped", async () => {
    const owner = await freshOwner();
    const beneficiary = anchor.web3.Keypair.generate();
    const pda = await initialize(owner, beneficiary.publicKey);

    await sleep((INTERVAL + 2) * 1000);
    await expectError(claim(pda, beneficiary), "ClaimNotStarted");
  });

  it("owner check_in during the challenge window vetoes the claim", async () => {
    const owner = await freshOwner();
    const beneficiary = anchor.web3.Keypair.generate();
    const pda = await initialize(owner, beneficiary.publicKey);

    await sleep((INTERVAL + 2) * 1000);
    await startClaim(pda, beneficiary);
    await expectError(startClaim(pda, beneficiary), "ClaimAlreadyStarted");

    const sig = await program.methods
      .checkIn()
      .accountsPartial({ switch: pda, owner: owner.publicKey })
      .signers([owner])
      .rpc();
    await connection.confirmTransaction(sig, "confirmed");
    const tx = await connection.getTransaction(sig, { commitment: "confirmed" });
    const parser = new anchor.EventParser(program.programId, program.coder);
    const events = [...parser.parseLogs(tx.meta.logMessages)];
    assert.ok(events.find((e) => e.name === "claimVetoed"), "ClaimVetoed should be emitted");

    assert.equal((await program.account.switch.fetch(pda)).claimStartedAt.toNumber(), 0);

    // The vetoed claim can't finish, and a new one can't start until the
    // fresh interval elapses.
    await expectError(claim(pda, beneficiary), "ClaimNotStarted");
    await expectError(startClaim(pda, beneficiary), "StillActive");
  });

  it("update_config clears a pending claim", async () => {
    const owner = await freshOwner();
    const beneficiary = anchor.web3.Keypair.generate();
    const pda = await initialize(owner, beneficiary.publicKey);

    await sleep((INTERVAL + 2) * 1000);
    await startClaim(pda, beneficiary);
    await program.methods
      .updateConfig(null, new anchor.BN(INTERVAL + 1))
      .accountsPartial({ switch: pda, owner: owner.publicKey })
      .signers([owner])
      .rpc();
    assert.equal((await program.account.switch.fetch(pda)).claimStartedAt.toNumber(), 0);
  });

  it("start_claim reverts if caller is not the beneficiary", async () => {
    const owner = await freshOwner();
    const beneficiary = anchor.web3.Keypair.generate();
    const pda = await initialize(owner, beneficiary.publicKey);

    await sleep((INTERVAL + 2) * 1000);
    const imposter = await freshOwner();
    await expectError(startClaim(pda, imposter), "Unauthorized");
  });

  it("beneficiary can find vaults naming them via a memcmp filter", async () => {
    const owner = await freshOwner();
    const beneficiary = anchor.web3.Keypair.generate();
    const pda = await initialize(owner, beneficiary.publicKey);

    // Account layout: 8 discriminator | 32 owner | 32 beneficiary | ...
    const found = await program.account.switch.all([
      { memcmp: { offset: 8 + 32, bytes: beneficiary.publicKey.toBase58() } },
    ]);
    assert.equal(found.length, 1);
    assert.ok(found[0].publicKey.equals(pda));
  });

  it("start_claim reverts with StillActive before the interval", async () => {
    const owner = await freshOwner();
    const beneficiary = anchor.web3.Keypair.generate();
    const pda = await initialize(owner, beneficiary.publicKey);

    await expectError(startClaim(pda, beneficiary), "StillActive");
  });

  it("claim reverts if caller is not the beneficiary", async () => {
    const owner = await freshOwner();
    const beneficiary = anchor.web3.Keypair.generate();
    const pda = await initialize(owner, beneficiary.publicKey);

    await sleep((INTERVAL + 2) * 1000);

    const imposter = await freshOwner();
    await expectError(claim(pda, imposter), "Unauthorized");
  });

  it("check_in reverts if caller is not the owner", async () => {
    const owner = await freshOwner();
    const beneficiary = anchor.web3.Keypair.generate();
    const pda = await initialize(owner, beneficiary.publicKey);

    const imposter = await freshOwner();
    try {
      await program.methods
        .checkIn()
        .accountsPartial({ switch: pda, owner: imposter.publicKey })
        .signers([imposter])
        .rpc();
      assert.fail("expected check_in by non-owner to revert");
    } catch (e) {
      // CheckIn's PDA is seeded on the signer, so a non-owner derives a
      // different address than the real switch and the seeds guard rejects it.
      assert.include(e.toString(), "ConstraintSeeds");
    }
  });

  it("initialize rejects intervals outside [MIN_INTERVAL, MAX_INTERVAL]", async () => {
    const owner = await freshOwner();
    const beneficiary = anchor.web3.Keypair.generate();
    const pda = switchPda(owner.publicKey);
    const minInterval = 5;
    const maxInterval = 10 * 365 * 86_400;
    for (const interval of [0, minInterval - 1, maxInterval + 1]) {
      await expectError(
        program.methods
          .initialize(beneficiary.publicKey, new anchor.BN(interval), new anchor.BN(AMOUNT))
          .accountsPartial({ switch: pda, owner: owner.publicKey })
          .signers([owner])
          .rpc(),
        "InvalidInterval"
      );
    }
  });

  it("initialize rejects a zero amount", async () => {
    const owner = await freshOwner();
    const beneficiary = anchor.web3.Keypair.generate();
    const pda = switchPda(owner.publicKey);
    try {
      await program.methods
        .initialize(beneficiary.publicKey, new anchor.BN(INTERVAL), new anchor.BN(0))
        .accountsPartial({ switch: pda, owner: owner.publicKey })
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
        .accountsPartial({ switch: pda, owner: owner.publicKey })
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
      .accountsPartial({ switch: pda, owner: owner.publicKey })
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
        .accountsPartial({ switch: pda, owner: imposter.publicKey })
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
      .accountsPartial({ switch: pda, owner: owner.publicKey })
      .signers([owner])
      .rpc();

    const acct = await program.account.switch.fetch(pda);
    assert.ok(acct.beneficiary.equals(newBeneficiary.publicKey));

    // Rejects an interval of zero.
    try {
      await program.methods
        .updateConfig(null, new anchor.BN(0))
        .accountsPartial({ switch: pda, owner: owner.publicKey })
        .signers([owner])
        .rpc();
      assert.fail("expected InvalidInterval");
    } catch (e) {
      assert.include(e.toString(), "InvalidInterval");
    }

    // The original beneficiary can no longer claim; the new one can.
    await sleep((INTERVAL + 2) * 1000);
    await expectError(startClaim(pda, beneficiary), "Unauthorized");
    await startClaim(pda, newBeneficiary);
    await sleep((CHALLENGE + 2) * 1000);
    await claim(pda, newBeneficiary);
    assert.isNull(await connection.getAccountInfo(pda));
  });

  it("emits a CheckedIn event on check_in", async () => {
    const owner = await freshOwner();
    const beneficiary = anchor.web3.Keypair.generate();
    const pda = await initialize(owner, beneficiary.publicKey);

    const sig = await program.methods
      .checkIn()
      .accountsPartial({ switch: pda, owner: owner.publicKey })
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
      .accountsPartial({ switch: pda, owner: owner.publicKey })
      .signers([owner])
      .rpc();
    const after = await connection.getBalance(owner.publicKey);
    assert.isAbove(after, before); // got deposit + rent back

    const closed = await connection.getAccountInfo(pda);
    assert.isNull(closed);

    // Switch is gone, so a later claim cannot resolve the account.
    await sleep((INTERVAL + 2) * 1000);
    try {
      await startClaim(pda, beneficiary);
      assert.fail("start_claim should fail against a cancelled switch");
    } catch (e) {
      assert.notInclude(e.toString(), "should fail"); // account does not exist
    }
  });
});
