# Solana Dead Man's Switch

**Track:** Best Use of Solana
**Pitch:** A trustless, server-less inheritance vault. Funds release to a named beneficiary only if the owner stops checking in. No custodian, no keeper bot — all enforcement on-chain.

**Core insight:** Time is enforced *lazily*. There is no cron job or background process. The beneficiary's `claim` transaction itself checks whether enough time has passed since the owner's last check-in. The check-in *is* the liveness signal.

---

## Status

- [x] Phase 0 — Setup (toolchain, wallets funded)
- [x] Phase 1 — Program (initialize, check_in, deposit, update_config, claim, cancel) — **deployed to devnet**, IDL frozen
- [x] Phase 2 — Anchor tests — `anchor test` green (11 passing)
- [~] Phase 3 — Frontend — **UI complete, on-chain wiring in progress** (see below)
- [ ] Phase 4 — Demo prep
- [ ] Phase 5 — Submission

**Devnet program ID:** `6gbTnghr3AXPbCTjieq3veCmt656ALbEd7VUGX9z5fFu` — live on devnet (upgradeable; upgrade authority = owner wallet). On-chain IDL available via `anchor idl fetch`.

### Phase 3 detail

The frontend (`app/`) is a Vite + React + TS app in a single visual language —
**"Terminal Vault"** (black / neon-green, JetBrains Mono, CRT scanlines). It's a
five-screen *cinematic wizard*, not a single control panel:

| Route | Screen | Status |
|---|---|---|
| `/` | Cold open — manifesto + INITIATE | ✅ built |
| `/identify` | Role select — OWNER vs BENEFICIARY | ✅ built |
| `/arm` | Owner wizard — beneficiary → interval → amount → oath → reminders | ✅ UI · ⏳ tx mocked |
| `/cockpit` | Owner cockpit — live countdown, CHECK_IN, deposit/edit/reminders/cancel | ✅ UI · ⏳ tx mocked |
| `/watch` | Beneficiary — watch the countdown, claim at zero | ✅ UI · ⏳ tx mocked |

- ✅ **Wired:** wallet-adapter (Phantom + Solflare, devnet), live balance, drift-free
  `Date.now()`-based countdown, routing, accessibility (focus rings, reduced-motion,
  WCAG-AA contrast, modal focus-trap), `?demo=1` state-preview flag.
- ⏳ **Mocked (next):** the six program instructions, the Supabase `subscribe` POST,
  and the event-driven activity feed are stubbed with `// TODO` markers and a fake
  tx overlay. The full visual lifecycle runs; no transaction is broadcast yet.

**Done when:** full lifecycle runnable from the browser on devnet — i.e. the `// TODO`
markers are replaced with real `program.methods.*().rpc()` calls. See `app/README.md`.

---

## Repo layout

```
deadman-switch/
├── programs/deadman-switch/   # Anchor program (Device A)
├── tests/                     # Anchor tests in TS (Device A)
├── scripts/smoke-devnet.ts    # Full-lifecycle smoke test against live devnet
├── app/                       # Vite + React frontend (Device B) — see app/README.md
├── design-mockups/            # Static HTML mockups (design history; superseded by app/)
├── supabase/                  # Off-chain reminder notifier (Postgres + 2 Edge Functions)
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
# Device A — program tests
anchor test

# Device A — full lifecycle against live devnet
npx ts-node scripts/smoke-devnet.ts

# Device B — frontend dev server
cd app && npm install && npm run dev   # http://localhost:5173
```

**Walk the demo flow:** open `/` → INITIATE → pick OWNER → step through the wizard →
land in the cockpit. Or pick BENEFICIARY → load an owner address → watch the countdown
→ CLAIM at zero. Append `?demo=1` to `/cockpit` or `/watch` to reveal the hidden
state-preview toggle (lets you jump straight to CLAIMABLE/EXPIRED for rehearsal).

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

---

## Reminders (off-chain, advisory)

The on-chain program is self-sufficient. On top of it, an **optional** notifier
warns the owner before their switch unlocks so they can check in. It lives in
`supabase/` (Postgres + two Edge Functions) and is the only off-chain piece:

- `subscribe` — the frontend registers the owner's email / Telegram + cadence
  (`lead_seconds`, `frequency_seconds`). It verifies the switch exists on-chain
  and that `owner_pubkey` matches `switch.owner` before storing anything.
- `reminder-tick` — runs every minute (pg_cron), reads each switch's
  `last_checkin + interval` straight off devnet, and fires email (Resend) +
  Telegram when inside the owner's chosen warning window.

**This is purely advisory — it is not part of enforcement.** `claim` still
requires the on-chain time gate, so even if the notifier is down, late, or wiped,
funds are exactly as safe. Contact info is PII and lives off-chain only (never on
the public ledger). See `supabase/SETUP.md` for secrets, the frontend contract,
and operations.
