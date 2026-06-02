# Demo Preflight Checklist · T–15 minutes

Tick every box. The day-of failure modes are dumb ones (Phantom locked, wrong cluster, RPC dead, balance too low) — this list catches all of them.

If anything below fails and can't be fixed in 5 minutes, switch to the backup recording. The recording wins gracefully; a broken live demo doesn't.

---

## Wallets · Phantom on devnet

- [ ] **Phantom unlocked** and pinned in browser toolbar
- [ ] **Devnet** selected in Phantom (Settings → Developer Settings → Testnet Mode ON, Devnet)
- [ ] **OWNER account** loaded, balance ≥ **0.3 SOL** (covers ~5 demo runs · `initialize` × 5 + `check_in` × 5 + fees)
- [ ] **BENEFICIARY account** loaded, balance ≥ **0.01 SOL** (just covers the `claim` tx fee)
- [ ] You can confirm which account is which without thinking — they're named, not just "Account 1 / Account 2"
- [ ] **OWNER** is the currently-selected account when the demo begins

If a balance is short, airdrop now — do **not** airdrop on stage:
```
solana airdrop 2 <OWNER_PUBKEY> --url devnet
solana airdrop 0.05 <BENEFICIARY_PUBKEY> --url devnet
```

## RPC endpoint · don't trust the public faucet RPC

The app reads `VITE_RPC_URL` from `app/.env.local`. For the live demo, point it at a dedicated devnet endpoint (Helius) so a rate-limited public RPC can't stall a tx mid-stage.

- [ ] `app/.env.local` exists with `VITE_RPC_URL=https://devnet.helius-rpc.com/?api-key=...`
- [ ] **Restart `npm run dev`** after creating/editing `.env.local` (Vite only reads env at startup)
- [ ] Sanity check it's live: open the app, connect Phantom, the WalletPill shows a real SOL balance (proves the RPC answers)
- [ ] Use the same endpoint in the scripts below: `export RPC_URL=https://devnet.helius-rpc.com/?api-key=...`

## On-chain state · no leftover switch

The PDA is seeded on `("switch", owner.pubkey)`. If a previous switch already occupies it, the new `initialize` fails with **already in use**.

Two reset paths — know which applies:

- **Live-arm rehearsal** (you ARM through the app with Phantom): the switch is owned by your **Phantom OWNER**. Reset it with the **CANCEL** button in `/cockpit`, or just let a successful **claim** close it (claim drains + closes the PDA, freeing the slot automatically). The CLI seed script can't reset this one — it can't sign as your Phantom owner.
- **Check state any time** (read-only, no signing):
  ```
  cd /Users/ethanterrero/Desktop/solana-deadman-switch
  OWNER_PUBKEY=<PHANTOM_OWNER_PUBKEY> node app/scripts/switch-state.mjs
  ```
  Want "no switch (PDA empty)" before a fresh live ARM.

- **"Cut to the bone" fallback** (skip arming — pre-seed a claimable switch owned by the CLI wallet, claim with Phantom B): run once, then it's claimable after the interval elapses.
  ```
  cd /Users/ethanterrero/Desktop/solana-deadman-switch
  BENEFICIARY_PUBKEY=<PHANTOM_BENEFICIARY_PUBKEY> \
  INTERVAL_SECONDS=30 AMOUNT_SOL=0.1 \
  RPC_URL=$RPC_URL \
    node app/scripts/seed-switch.mjs
  ```
  Requires the CLI wallet (`9a95…X6MK`, `~/.config/solana/id.json`) funded with ≥ ~0.2 devnet SOL. In the app, go to `/watch`, look up the owner it prints, and CLAIM with Phantom B once the countdown hits 0.

## Dev server · already running

- [ ] `npm run dev --prefix app` running on **5173**
- [ ] Browser tab can hit `http://localhost:5173` and the cold open renders
- [ ] No errors in DevTools console (close DevTools before the demo — it eats screen space)

## Browser tabs

- [ ] **Tab 1** (active): `http://localhost:5173/` — cold open
- [ ] **Tab 2** (behind): `http://localhost:5173/watch` — empty WatchClaim screen
- [ ] **`/arm?fast=1`** bookmarked or muscle-memorized — the Identify keyboard nav drops the `?fast=1` flag, so the only reliable path is to type the URL directly or use the bookmark **after** clicking OWNER

## Browser hygiene

- [ ] Zoom set to **125%** (or whatever reads well on the projector — test on the actual screen)
- [ ] Dark mode honored everywhere (the UI is black/neon — projector contrast)
- [ ] **System notifications OFF** (`Do Not Disturb` on macOS, also kill Slack/Mail/iMessage)
- [ ] **Browser notifications OFF** for solana.com, supabase.com, anything else that might pop
- [ ] No other tabs visible if you `Cmd-Shift-T` by accident
- [ ] Bookmarks bar clean — no embarrassing bookmarks visible in projection

## Network

- [ ] `ping api.devnet.solana.com` returns under 200ms
- [ ] Submit a no-op tx (`solana balance --url devnet`) — verify devnet RPC actually answers
- [ ] Backup RPC URL written down somewhere (Helius/QuickNode if you have one) in case `api.devnet.solana.com` flakes

## Clipboard primed

- [ ] **BENEFICIARY pubkey** on clipboard at start (you'll paste it at step 1 of the wizard, t=0:18)
- [ ] Keep a sticky note (physical or app) with both pubkeys in case clipboard gets nuked

## Backup recording

- [ ] **Clean run pre-recorded** within the last 24 hours, file accessible without an internet round-trip
- [ ] Recording opens to **full-screen** in one keypress (Cmd-Ctrl-F in QuickTime, F in VLC)
- [ ] You know exactly which keystroke kills the live demo and starts the backup (probably `Cmd-Tab` to the recording app)

## Final checks · T–60 seconds

- [ ] Phantom popup not blocked (Chrome sometimes mutes extension popups — click the Phantom icon once to wake it)
- [ ] Cold-open tab is **focused** (click inside it once)
- [ ] Take a breath. Spit out gum if you have it.
- [ ] One slow exhale.

When you're ready: hit `Enter` to skip the typewriter, or just let it run.
