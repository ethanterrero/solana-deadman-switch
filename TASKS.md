# Live Task Board

Tick tasks as you ship them. Owner column tells you which device picks it up.

## Now (do today)

| # | Owner | Task | Blocking? |
|---|---|---|---|
| ~~1~~ | A | ~~Install anchor (`avm`) + verify `anchor --version`~~ ✅ | done |
| ~~2~~ | A | ~~`solana config set --url devnet` + generate owner keypair + airdrop 2 SOL~~ ✅ | done |
| ~~3~~ | A | ~~Generate beneficiary keypair to `~/.config/solana/beneficiary.json`~~ ✅ | done |
| ~~4~~ | A | ~~`anchor init` overlay into this repo and confirm stock deploy~~ ✅ | done |
| 5 | B | `npm create vite@latest app -- --template react-ts` | no |
| 6 | B | Install `@solana/web3.js`, `@coral-xyz/anchor`, `@solana/wallet-adapter-react`, `@solana/wallet-adapter-react-ui`, `@solana/wallet-adapter-wallets` | no |
| 7 | B | Drop in wallet adapter provider + connect button | no |

## Next (after current batch)

| # | Owner | Task | Depends on |
|---|---|---|---|
| ~~8~~ | A | ~~Implement `Switch` state + `initialize` + `check_in`~~ ✅ (+`deposit`, `update_config`, events) | done |
| ~~9~~ | A | ~~Implement `claim` + `cancel` + errors~~ ✅ | done |
| ~~10~~ | A | ~~Update `declare_id!` and `Anchor.toml` with deployed program ID, redeploy~~ ✅ | done |
| ~~11~~ | A | ~~Commit IDL + program ID — **handoff signal to B**~~ ✅ handoff sent | done |
| 12 | B | Hand-write `Switch` type stub matching PLAN.md state | 7 |
| 13 | B | Build `InitForm` + `StatusPanel` + `ActionButtons` skeletons against the stub | 12 |
| ~~14~~ | A | ~~Write happy-path Anchor test~~ ✅ | done |
| ~~15~~ | A | ~~Write 4 failure-mode tests~~ ✅ 11 passing + devnet smoke test | done |
| 16 | B | Pull IDL, swap stub for real Anchor `Program` client | 11, 13 |
| 17 | B | Wire all 4 buttons end-to-end against devnet | 16 |
| 18 | B | Implement LOCKED/CLAIMABLE badge + countdown with color flip | 17 |

## Demo + ship

| # | Owner | Task | Depends on |
|---|---|---|---|
| 19 | Both | Pre-fund both wallets enough for ~5 demo runs | 11 |
| 20 | Both | Write demo script (under 2 min) | 18 |
| 21 | A | Record terminal-fallback video (anchor test full output) | 15 |
| 22 | B | Record browser happy-path video | 18 |
| 23 | Both | Rehearse live demo, time it twice | 20 |
| 24 | B | Finalize README with devnet program ID + architecture | 11 |
| 25 | B | Tag release + fill out submission form | 24 |

## Cuts available if behind (in order, top first)
- Drop `cancel` ix (and its button + test)
- Drop countdown — plain LOCKED/CLAIMABLE label
- Drop the frontend entirely, demo from `anchor test` output
- **Never cut:** `initialize`, `check_in`, `claim`, `StillActive` guard
