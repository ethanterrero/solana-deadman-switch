# Build Plan

Source of truth for what to build, in order. Mirrors the original brief; mark phases complete here as you ship them.

## Phase 0 — Setup (~30 min) — **Device A**
- [x] `solana --version`, `anchor --version`, `rustc --version` all green
  - Anchor needs install: `cargo install --git https://github.com/coral-xyz/anchor avm --force && avm install latest && avm use latest`
- [x] `solana config set --url devnet`
- [x] Owner wallet: `solana-keygen new` + `solana airdrop 2`
- [x] Beneficiary wallet: `solana-keygen new -o ~/.config/solana/beneficiary.json`
- [x] `anchor init deadman-switch` inside this repo (or overlay into existing dir — see DEVICE_SPLIT.md)
- [x] Stock template builds + deploys: `anchor build && anchor deploy`
- [x] Commit clean scaffold

**Done when:** stock Anchor program deployed to devnet, two funded wallets exist.

---

## Phase 1 — Program (~2–3 hr) — **Device A**
- [x] `Switch` state: `owner, beneficiary, last_checkin, interval, amount, bump`
- [x] `initialize` — create Switch PDA seeded on owner, stamp `last_checkin = now`, deposit lamports
- [x] `check_in` — owner-only, set `last_checkin = now`
- [x] `claim` — beneficiary-only, require `now >= last_checkin + interval`, move lamports
- [x] `cancel` — owner-only, return funds
- [x] `SwitchError::{StillActive, Unauthorized, InvalidInterval, InvalidAmount, InvalidBeneficiary}`
- [x] `deposit` (top-up) + `update_config` (change beneficiary/interval) — added beyond original scope
- [x] Every ix emits an event (`SwitchInitialized, CheckedIn, Deposited, ConfigUpdated, Claimed, Cancelled`)
- [x] Update `declare_id!` + `Anchor.toml` with deployed program ID, redeploy
- [x] Commit IDL at `target/idl/deadman_switch.json` so Device B can consume

**Lamport movement:** keep funds in the Switch PDA itself; `claim`/`cancel` use the `close =` constraint to sweep the PDA's lamports (deposit + rent) to the recipient. Avoids CPI signing for a separate vault.

**Done when:** all ixs build + deploy; `initialize` callable from a test. ✅ live on devnet.

---

## Phase 2 — Tests (~1–1.5 hr) — **Device A**
- [x] Happy path: init → check_in → claim fails (StillActive) → sleep → claim succeeds
- [x] `claim` reverts with `StillActive` before interval
- [x] `claim` reverts if caller != beneficiary
- [x] `check_in` reverts if caller != owner
- [x] `cancel` returns funds + blocks later claim
- [x] Init guards (interval/amount/beneficiary), deposit owner-only, update_config swap, CheckedIn event decode
- [x] Use 5–10s test interval; `sleep` past the boundary
- [x] `scripts/smoke-devnet.ts` — full lifecycle against the live devnet program

**Done when:** `anchor test` green. ✅ 11 passing; devnet smoke test green.

---

## Phase 3 — Frontend (~2–3 hr) — **Device B**
- [ ] Vite + React + TS scaffold
- [ ] `@solana/web3.js`, `@coral-xyz/anchor`, `@solana/wallet-adapter-react` + UI
- [ ] Wallet connect, show pubkey + balance
- [ ] Initialize form: beneficiary pubkey, interval (default 30s), amount
- [ ] Status panel: `last_checkin`, computed `unlocks_at`, live countdown
- [ ] LOCKED / CLAIMABLE badge — make the flip visually loud (red → green)
- [ ] Four buttons: Initialize, Check In, Claim, Cancel
- [ ] Both wallet contexts work (switch between owner + beneficiary)

**Done when:** full lifecycle runnable from browser on devnet without touching terminal.

---

## Phase 4 — Demo prep (~1 hr) — **Both**
- [ ] Interval = 30s
- [ ] Both wallets pre-funded (no live airdrops on stage)
- [ ] Demo script written + timed under 2 min
- [ ] Backup screen recording of a clean run
- [ ] Rehearsed twice
- [ ] One-sentence answer for "how does it know the owner is gone?" → *the claim tx checks `now >= last_checkin + interval` against on-chain `Clock`*

---

## Phase 5 — Submission (~30 min) — **Device B**
- [ ] README finalized (problem, lazy-time-check insight, architecture, run steps, devnet program ID)
- [ ] Tag a release
- [ ] Submission form filled early
- [ ] Demo video uploaded if required

---

## Descope ladder (cut from top down when behind)
1. SPL token support (already out)
2. `cancel` instruction
3. Countdown UI — plain LOCKED/CLAIMABLE text suffices
4. Frontend entirely — demo from `anchor test` output
5. **Floor:** `initialize`, `check_in`, `claim`, `StillActive` guard
