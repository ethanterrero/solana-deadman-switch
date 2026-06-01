# Demo Q&A · the questions judges will actually ask

Two answers per question: the **one-liner** you say out loud, and a **deeper** explanation if they push. The one-liners are the ones to memorize.

---

## ⭐ The killer question (they will ask this)

> "How does the program know the owner is gone?"

**One-liner.** It doesn't. The program is lazy — when a beneficiary calls `claim`, it checks `now ≥ last_checkin + interval` against the on-chain `Clock` sysvar. If the time gate is open, the funds move. Nothing watches in between.

**Deeper.** Solana exposes the cluster's current Unix timestamp as a sysvar; every transaction can read it for free. The `claim` instruction:
```rust
let clock = Clock::get()?;
let now = clock.unix_timestamp;
require!(now >= switch.last_checkin + switch.interval, SwitchError::StillActive);
```
No keeper bot, no Switchboard oracle, no Pyth feed, no cron job. The "is the owner gone?" check happens *only* when somebody asks — which is the only moment the answer matters. This is why the protocol survives network outages, why it costs nothing to maintain, and why nobody can be censored into preventing a release.

---

## Architecture / security

> "What if the devnet (or mainnet) RPC is down?"

**One-liner.** The vault is safe. Funds sit in a PDA owned by the program. An RPC outage means *nobody* can transact — including a beneficiary trying to claim — but state is preserved. When the RPC comes back, the time gate re-opens automatically.

**Deeper.** There's no liveness assumption on any single off-chain component. The check_in cadence is the *owner's* problem; if they can't reach an RPC at the moment they need to check in, that's a real risk for them — but it's a risk they understand, and they can choose a longer interval to absorb network unreliability.

---

> "What stops the beneficiary from claiming early?"

**One-liner.** A `require!` macro in the `claim` instruction. Try to claim before the time gate and the tx reverts with `StillActive`.

**Deeper.** Same `clock.unix_timestamp` check as above. Solana's Clock is consensus-driven — every validator agrees on it. There's no race-window or oracle-manipulation surface; the timestamp is a single global value at slot N. A premature claim isn't a vulnerability you mitigate; it's an op that simply doesn't execute.

---

> "Why a PDA instead of a regular wallet?"

**One-liner.** A PDA has no private key. Only program code can move lamports out of it — that's what makes the vault *trustless*.

**Deeper.** A PDA (program-derived address) is a point off the ed25519 curve, so it can't be a real public key. There's no signer that can authorize an arbitrary transfer; the only way lamports leave the PDA is via the program's instructions, which encode the time gate. No admin key, no upgrade authority I retain access to, no escape hatch. The `close = recipient` constraint on `claim`/`cancel` does the lamport sweep without CPI signing.

---

> "What's the worst case? What can go wrong?"

**One-liner.** The owner forgets to check in and the vault releases. That's the *intended* worst case.

**Deeper.** I built reminders (email + Telegram via Supabase) explicitly so this doesn't surprise the user. Reminders are off-chain — if they fail, the funds are exactly as safe; the on-chain `claim` still requires the time gate. The other risk is the owner choosing an interval that's too short for their life. We mitigate this with sane defaults (30 days minimum in production) and an oath screen that forces them to read the consequence before signing.

---

## Why Solana, why not X

> "Why not just use a Switchboard oracle / a cron job / a keeper network?"

**One-liner.** All of those add a liveness dependency I don't need. The on-chain clock is already trustless and always available.

**Deeper.** A keeper bot has to *run* — and somebody has to pay it, and somebody has to maintain it. A Switchboard oracle is great when you need a fact that isn't on-chain (price, weather), but the cluster timestamp already is. The lazy-evaluation insight is the elegant part: time only matters at the moment of action, and the action carries the time check with it.

---

> "How is this different on Solana vs. Ethereum?"

**One-liner.** It works on either, but on Solana it's cheap enough to make a vault for $10, not $200.

**Deeper.** The pattern (time-gated escrow keyed on a heartbeat) is generic — you could write it in Solidity. What changes on Solana is the *economics*: rent + fees per initialize/check_in are sub-cent, so the protocol is usable by people locking $50, not just $50k. That's the user base I care about — people who want this for personal data, social-media accounts, family inheritance — not whales.

---

## Functional questions

> "Can the owner check in from a different device?"

Yes. The check_in instruction verifies `signer == switch.owner`. Any device that holds the owner's keypair can sign — phone, second laptop, hardware wallet.

---

> "What if the owner changes their mind?"

The owner can call `cancel` at any point before the beneficiary claims. It closes the PDA and returns lamports to the owner. The PDA slot becomes free again so the owner can create a new switch.

---

> "Can I have multiple beneficiaries?"

Not in v1 — the PDA is seeded on `(b"switch", owner.pubkey)` so one switch per owner. The natural v2 is a `Vec<Beneficiary>` with per-beneficiary shares; the claim instruction would iterate and pay each share. Not blocked by the model, just out of scope for the hackathon.

---

> "What about SPL tokens?"

Currently SOL only. Tokens require associated token accounts on both the PDA (as owner) and the claimant — doable, but it doubles the account list on every instruction and we cut it to ship. The time-gate pattern is unchanged.

---

> "How is this different from a multisig?"

A multisig says *who* can sign; this says *when* signing is allowed. They're orthogonal — you could build a switch where the owner's "key" is actually a multisig, and check_in requires N-of-M signatures from a family. That'd be a nice v2.

---

## Meta / process questions

> "How did you build the frontend so fast?"

One device did the program + tests + smoke script on devnet; the other built the React frontend against the committed IDL. Anchor's typed IDL meant zero coordination after handoff — `Program<DeadmanSwitch>` is the source of truth for both sides.

---

> "What's mocked vs. live?"

All six instructions are real on devnet — you just watched five of them. The off-chain bits (Supabase reminders POST, wallet adapter, balance polling) are also real. The activity feed is session-local rather than a `program.addEventListener` subscription — that's the next change.

---

> "Why is the UI so… loud?"

Because a dead man's switch is a serious commitment and the UI should feel like one. The oath screen exists to make sure nobody signs `initialize` by accident. Red flash, "NO CUSTODIAN. NO ADMIN KEY. NO BACKDOOR." — those aren't decoration, they're informed consent.

---

## If they ask the *really* hard one

> "What stops you from upgrading the program and breaking the contract?"

**One-liner.** Renounce the upgrade authority. The deployed program ID becomes immutable.

**Deeper.** Right now the program is upgradeable (it's a hackathon — we need to ship fixes). In production, `solana program set-upgrade-authority <PROGRAM_ID> --final` makes the code permanent. Once final, even I can't modify it. That's the move before the protocol holds real money.
