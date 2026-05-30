# Build Plan

Source of truth for what to build, in order. Mirrors the original brief; mark phases complete here as you ship them.

## Phase 0 — Setup (~30 min) — **Device A**
- [ ] `solana --version`, `anchor --version`, `rustc --version` all green
  - Anchor needs install: `cargo install --git https://github.com/coral-xyz/anchor avm --force && avm install latest && avm use latest`
- [ ] `solana config set --url devnet`
- [ ] Owner wallet: `solana-keygen new` + `solana airdrop 2`
- [ ] Beneficiary wallet: `solana-keygen new -o ~/.config/solana/beneficiary.json`
- [ ] `anchor init deadman-switch` inside this repo (or overlay into existing dir — see DEVICE_SPLIT.md)
- [ ] Stock template builds + deploys: `anchor build && anchor deploy`
- [ ] Commit clean scaffold

**Done when:** stock Anchor program deployed to devnet, two funded wallets exist.

---

## Phase 1 — Program (~2–3 hr) — **Device A**
- [ ] `Switch` state: `owner, beneficiary, last_checkin, interval, amount, bump`
- [ ] `initialize` — create Switch PDA seeded on owner, stamp `last_checkin = now`, deposit lamports
- [ ] `check_in` — owner-only, set `last_checkin = now`
- [ ] `claim` — beneficiary-only, require `now >= last_checkin + interval`, move lamports
- [ ] `cancel` — owner-only, return funds
- [ ] `SwitchError::{StillActive, Unauthorized}`
- [ ] Update `declare_id!` + `Anchor.toml` with deployed program ID, redeploy
- [ ] Commit IDL at `target/idl/deadman_switch.json` so Device B can consume

**Lamport movement:** keep funds in the Switch PDA itself; use `try_borrow_mut_lamports`. Avoids CPI signing for a separate vault.

**Done when:** all 4 ixs build + deploy; `initialize` callable from a test.

---

## Phase 2 — Tests (~1–1.5 hr) — **Device A**
- [ ] Happy path: init → check_in → claim fails (StillActive) → sleep → claim succeeds
- [ ] `claim` reverts with `StillActive` before interval
- [ ] `claim` reverts if caller != beneficiary
- [ ] `check_in` reverts if caller != owner
- [ ] `cancel` returns funds + blocks later claim
- [ ] Use 5–10s test interval; `sleep` past the boundary

**Done when:** `anchor test` green.

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
