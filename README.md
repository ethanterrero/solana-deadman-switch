# Solana Dead Man's Switch

**Track:** Best Use of Solana
**Pitch:** A trustless, server-less inheritance vault. Funds release to a named beneficiary only if the owner stops checking in. No custodian, no keeper bot — all enforcement on-chain.

**Core insight:** Time is enforced *lazily*. There is no cron job or background process. The beneficiary's `claim` transaction itself checks whether enough time has passed since the owner's last check-in. The check-in *is* the liveness signal.

---

## Status

- [x] Phase 0 — Setup (toolchain, wallets funded)
- [x] Phase 1 — Program (initialize, check_in, deposit, update_config, claim, cancel) — **deployed to devnet**, IDL frozen
- [x] Phase 2 — Anchor tests — `anchor test` green (11 passing)
- [ ] Phase 3 — Frontend
- [ ] Phase 4 — Demo prep
- [ ] Phase 5 — Submission

**Devnet program ID:** `6gbTnghr3AXPbCTjieq3veCmt656ALbEd7VUGX9z5fFu` — live on devnet (upgradeable; upgrade authority = owner wallet). On-chain IDL available via `anchor idl fetch`.

---

## Repo layout

```
deadman-switch/
├── programs/deadman-switch/   # Anchor program (Device A)
├── tests/                     # Anchor tests in TS (Device A)
├── app/                       # Vite + React frontend (Device B)
├── target/idl/                # Generated IDL — committed so Device B can consume
├── PLAN.md                    # Full build plan, phase by phase
├── DEVICE_SPLIT.md            # Two-device work split + handoffs
└── TASKS.md                   # Live checklist
```

---

## Quick start

### Prereqs (per device)
- **Device A (program):** Solana CLI, Rust, Anchor (via `avm`), Node
- **Device B (frontend):** Node + pnpm/npm only

### One-time setup
See `PLAN.md` Phase 0 for the exact commands. Short version:

```bash
# Device A only
cargo install --git https://github.com/coral-xyz/anchor avm --force
avm install latest && avm use latest
solana config set --url devnet
solana-keygen new                       # owner wallet
solana-keygen new -o ~/.config/solana/beneficiary.json
solana airdrop 2

cd programs/deadman-switch && anchor build && anchor deploy
```

### Run locally
```bash
# Device A
anchor test

# Device B
cd app && npm install && npm run dev
```

---

## How it works (judge talking point)

1. `initialize` creates a Switch PDA seeded on the owner pubkey, stores `(owner, beneficiary, last_checkin, interval, amount)`, and deposits SOL into the PDA. Guards: `interval > 0`, `amount > 0`, `beneficiary != owner`.
2. `check_in` (owner only) resets `last_checkin = Clock::now()`.
3. `deposit` (owner only) tops up a live switch with more SOL.
4. `update_config` (owner only) changes the beneficiary and/or interval.
5. `claim` (beneficiary only) requires `now >= last_checkin + interval`, otherwise reverts with `StillActive`.
6. `cancel` (owner only) returns funds.

Every instruction emits an event (`SwitchInitialized`, `CheckedIn`, `Deposited`, `ConfigUpdated`, `Claimed`, `Cancelled`) so the frontend can render a live activity feed and react to a claim.

The deadline is never *triggered* — it is *checked* by the claim transaction. No keeper, no cron. The vault is alive forever and only releases when both the time gate and the beneficiary signature align.
