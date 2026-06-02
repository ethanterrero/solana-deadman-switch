# Backup Recording + Rehearsal Loop

Two jobs this file covers: (1) how to rehearse the live flow repeatedly against real on-chain state, and (2) how to capture a clean backup recording that wins gracefully if the live demo breaks on stage.

See [DEMO.md](DEMO.md) for the beat-by-beat script and [DEMO_PREFLIGHT.md](DEMO_PREFLIGHT.md) for the T–15 checklist.

---

## Rehearsal loop (run this until you can hit 1:35–1:50 twice)

1. **Confirm clean state** — the owner PDA must be empty before a fresh ARM:
   ```
   OWNER_PUBKEY=<PHANTOM_OWNER_PUBKEY> node app/scripts/switch-state.mjs
   ```
   Want: `STATE: no switch (PDA empty)`.
2. **Run the live flow** through the app: cold open → OWNER → `/arm?fast=1` → 30s / 0.1 / ARM IT → cockpit → tab 2 `/watch` → wait for CLAIMABLE → CLAIM with Phantom B.
3. **Reset for the next run:**
   - If you completed the CLAIM: the PDA is already closed — nothing to do.
   - If you bailed before claiming: click **CANCEL** in `/cockpit` (Phantom OWNER signs), or wait out the countdown and claim.
4. Re-check state (step 1) → should be empty again. Repeat.

Time each run end-to-end. If you blow past 2:00, the usual culprit is the Phantom account-switch at t=1:28 — drill that in isolation (see DEMO.md's micro-script).

---

## Backup recording — shot list

Record this the night before (within 24h of the demo) so it reflects the deployed program. It is the safety net; treat it like the real thing.

**Capture settings**
- [ ] QuickTime (Cmd-Ctrl-F for full-screen) or VLC (`F`). Know the full-screen keystroke cold.
- [ ] Record at the **projector resolution** you'll use, browser zoom **125%**, dark mode on.
- [ ] **Do Not Disturb ON**, Slack/Mail/iMessage quit, no notification popups.
- [ ] No DevTools open, clean bookmarks bar, no stray tabs.
- [ ] Mic on if you want narration baked in; otherwise narrate live over the silent video.

**Take checklist (one clean pass, no cuts)**
- [ ] Pre-stage: tab 1 = cold open, tab 2 = `/watch`, Phantom unlocked on OWNER, beneficiary pubkey on clipboard, owner PDA empty (`switch-state.mjs`).
- [ ] Start recording, then run the exact DEMO.md beats:
  - cold open → INITIATE → OWNER → `/arm?fast=1`
  - paste beneficiary → NEXT → **30s** → NEXT → **0.1** → NEXT → ARM IT → **approve `initialize` in Phantom**
  - SKIP TO COCKPIT → countdown visible (point at it)
  - copy owner pubkey → tab 2 → paste → LOOK UP → watching mode (no claim button)
  - countdown → 0 → CLAIMABLE flash → switch Phantom to BENEFICIARY → CLAIM → **approve `claim`** → claimed/drained screen
- [ ] Stop recording. **Watch it back start-to-finish.** No hangs, both Phantom approvals visible, final screen shows the vault drained.
- [ ] Save as `deadman-demo-backup.mov` somewhere openable **without internet** (local Desktop).
- [ ] Re-seed/reset state afterward so your *live* attempt starts clean.

**On stage, if live breaks:** stop narrating the broken thing, `Cmd-Tab` to the recording app, full-screen, play, narrate over it. Never apologize for the network — "let me show you the run I captured" is a clean recovery.

---

## What can go wrong + the one-line fix

| Symptom | Fix |
|---|---|
| `initialize` "already in use" | Leftover switch on the owner PDA — CANCEL in `/cockpit` or run `switch-state.mjs` to confirm, then cancel. |
| Tx hangs >5s | Keep narrating; devnet is slower than mainnet. If using public RPC, this is why you set `VITE_RPC_URL` to Helius. |
| WalletPill shows `…` forever | RPC not answering — check `.env.local`, restart `npm run dev`. |
| `/watch` won't flip to CLAIMABLE | Countdown is `Date.now()`-driven vs on-chain `unlock_at`; verify with `switch-state.mjs` (shows CLAIMABLE NOW vs LOCKED in Ns). |
| Everything broken | Switch to the backup recording. It wins. |
