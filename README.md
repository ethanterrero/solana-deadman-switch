# Solana Dead Man's Switch

**Track:** Best Use of Solana
**Pitch:** A trustless, server-less inheritance vault. Funds release to a named beneficiary only if the owner stops checking in. No custodian, no keeper bot — all enforcement on-chain.

**Core insight:** Time is enforced *lazily*. There is no cron job or background process. The beneficiary's `claim` transaction itself checks whether enough time has passed since the owner's last check-in. The check-in *is* the liveness signal.

---

## Status

- [x] Phase 0 — Setup (toolchain, wallets generated; devnet airdrop pending — faucet rate-limited)
- [x] Phase 1 — Program (initialize, check_in, claim, cancel) — builds, IDL frozen
- [x] Phase 2 — Anchor tests — `anchor test` green (5 passing)
- [ ] Phase 3 — Frontend
- [ ] Phase 4 — Demo prep
- [ ] Phase 5 — Submission

**Devnet program ID:** `6gbTnghr3AXPbCTjieq3veCmt656ALbEd7VUGX9z5fFu` (pinned in `declare_id!` + `Anchor.toml`; `anchor deploy` pending owner-wallet funding)

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

1. `initialize` creates a Switch PDA seeded on the owner pubkey, stores `(owner, beneficiary, last_checkin, interval, amount)`, and deposits SOL into the PDA.
2. `check_in` (owner only) resets `last_checkin = Clock::now()`.
3. `claim` (beneficiary only) requires `now >= last_checkin + interval`, otherwise reverts with `StillActive`.
4. `cancel` (owner only) returns funds.

The deadline is never *triggered* — it is *checked* by the claim transaction. No keeper, no cron. The vault is alive forever and only releases when both the time gate and the beneficiary signature align.
