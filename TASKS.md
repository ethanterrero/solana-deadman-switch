# Live Task Board

Tick tasks as you ship them. Owner column tells you which device picks it up.

## Now (do today)

| # | Owner | Task | Blocking? |
|---|---|---|---|
| 16 | B | Import IDL → build typed Anchor `Program` client + `useProgram` hook | yes — gates 17–20 |
| 17 | B | Wire `initialize` (wizard ARM IT) + fetch Switch account on cockpit load | 16 |
| 18 | B | Wire cockpit actions: `check_in`, `deposit`, `update_config`, `cancel` | 16 |
| 19 | B | Wire `claim` on the beneficiary screen | 16 |
| 20 | B | Real Supabase `subscribe` POST (replace mocked overlay) | 16 |

## Done

| # | Owner | Task |
|---|---|---|
| ~~1–4~~ | A | ~~Toolchain, devnet config, owner + beneficiary keypairs, anchor init/deploy~~ ✅ |
| ~~5~~ | B | ~~Vite + React + TS scaffold (`app/`)~~ ✅ |
| ~~6~~ | B | ~~Install web3.js / anchor / wallet-adapter packages~~ ✅ |
| ~~7~~ | B | ~~Wallet adapter provider + connect button (Phantom + Solflare)~~ ✅ |
| ~~8–9~~ | A | ~~`Switch` state, all 6 instructions, errors, events~~ ✅ |
| ~~10–11~~ | A | ~~`declare_id!` + `Anchor.toml` + commit IDL — handoff to B~~ ✅ |
| ~~12–13~~ | B | ~~UI built straight against the committed IDL types (no stub needed)~~ ✅ |
| ~~14–15~~ | A | ~~Happy-path + failure-mode tests (11 passing) + devnet smoke test~~ ✅ |
| ~~18b~~ | B | ~~LOCKED/CLAIMABLE flip + drift-free countdown (visual; tx wiring pending)~~ ✅ |
| — | B | ~~All 5 cinematic-wizard screens, accessibility pass, `?demo=1` flag~~ ✅ |

## Demo + ship

| # | Owner | Task | Depends on |
|---|---|---|---|
| 21 | Both | Pre-fund both wallets enough for ~5 demo runs | 11 |
| 22 | Both | Write demo script (under 2 min) | 17–19 |
| 23 | A | Record terminal-fallback video (anchor test full output) | 15 |
| 24 | B | Record browser happy-path video | 17–19 |
| 25 | Both | Rehearse live demo, time it twice | 22 |
| 26 | B | Finalize README with devnet program ID + architecture | 11 |
| 27 | B | Tag release + fill out submission form | 26 |

## Cuts available if behind (in order, top first)
- Drop `cancel` ix (and its button + test)
- Drop countdown — plain LOCKED/CLAIMABLE label
- Drop the frontend entirely, demo from `anchor test` output
- **Never cut:** `initialize`, `check_in`, `claim`, `StillActive` guard
