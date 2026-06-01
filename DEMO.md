# Live Demo Script · under 2:00

One device, two browser tabs, two Phantom accounts on devnet. Target wall-clock: **1:35–1:50**. Anything past 2:00 is over budget — practice until you can hit it twice in a row.

For the day-of checklist see [DEMO_PREFLIGHT.md](DEMO_PREFLIGHT.md). For judge questions see [DEMO_QA.md](DEMO_QA.md).

---

## Setup at "lights up"

- **Tab 1** (left): `http://localhost:5173/` — cold-open page, dev server already running.
- **Tab 2** (right, behind tab 1): `http://localhost:5173/watch` — empty, waiting for the owner pubkey.
- **Phantom** open in toolbar, **OWNER** account selected, devnet, popup unlocked.
- **Clipboard**: BENEFICIARY pubkey ready (`Cmd-V` will paste it in the wizard).
- **Notifications**: off. Slack/Mail/iMessage do not interrupt this.

The wizard URL you'll navigate to is `/arm?fast=1` — that flag switches the interval step from days to seconds (30s preset). Without it, the smallest selectable interval is 1 day and the demo doesn't work.

---

## Beat table

| t | Screen | Action | Narration (≈ what to say, not verbatim) |
|---|---|---|---|
| **0:00** | Tab 1 · cold open | `Enter` (skip typewriter) or just let it run ~3s | "Solana never forgets a transaction. So I built a vault that never forgets to release." |
| **0:08** | Cold open · INITIATE button visible | Click **INITIATE ▶▶** | (silent) |
| **0:12** | `/identify` | Click the **OWNER** card | "Two roles. Today I'm the owner." |
| **0:18** | `/arm?fast=1` step 1 — beneficiary input | Type the URL bar so `?fast=1` is appended (or use the bookmark) · `Cmd-V` to paste beneficiary pubkey · `NEXT` | "I tell the chain who inherits." |
| **0:30** | step 2 — interval (seconds, FAST MODE banner) | Click the **30s** preset · `NEXT` | "And how long I have to check in. Thirty seconds for the demo — production has days, weeks, years." |
| **0:38** | step 3 — amount | Click **0.1** preset · `NEXT` | "And how much I'm locking." |
| **0:43** | step 4 — OATH | Click **I UNDERSTAND ▸ ARM IT** | "Last chance. The program is `6gbT…fFu`. No one can override it." |
| **0:46** | Phantom popup — `initialize` | Approve | "This is the `initialize` instruction. The program creates a PDA — a program-derived account — and lamports move in." |
| **0:52** | back on the wizard · step 5 reminders | Click **SKIP ▸ TO COCKPIT** | "Email reminders exist; skipping for time." |
| **0:55** | `/cockpit` — countdown ~25s, LOCKED amber | (pause, point at countdown) | "There's the countdown. Live from on-chain. I am the only person who can stop the funds from releasing — by checking in." |
| **1:05** | (still cockpit) | **Cmd-click the address pill** to copy owner pubkey, then `Cmd-Tab` (or click) to **Tab 2** | "Now I switch hats. Beneficiary's view." |
| **1:10** | Tab 2 · `/watch` empty state | `Cmd-V` owner pubkey · click **LOOK UP** | (paste, click) |
| **1:15** | `/watch` watching mode — same countdown, NO claim button | (point) | "Same vault, beneficiary's side. Critically — there's no claim button yet. The program **rejects** any claim before the time gate." |
| **1:25** | Countdown hits 0 → screen flashes → **CLAIMABLE** | (let it land) | "There. Time gate satisfied." |
| **1:28** | CLAIM button visible | Open Phantom · switch to **BENEFICIARY** account · click **CLAIM** | "And now — only now — the beneficiary can claim." |
| **1:32** | Phantom popup — `claim` | Approve | "Claim runs the same time check on-chain. If the clock weren't past, this would revert." |
| **1:38** | claimed screen — green confirmation, vault drained | (smile) | "Vault closed. 0.1 SOL moved. No human in the loop. Just code, and time." |

End: ~1:40. Buffer 20s.

---

## Phantom account-switch micro-script (the only fiddly bit, t=1:28)

Practice this until it's three motions:
1. Click the Phantom icon in the browser toolbar.
2. Click the account dropdown (top of the Phantom panel).
3. Click **BENEFICIARY** account.

Phantom triggers a reconnect on the page when you switch. The `/watch` screen should auto-detect the new wallet inside ~1s. If it doesn't, click **DISCONNECT** in the WalletPill and reconnect.

---

## Fallback branches

| If… | Then… |
|---|---|
| `initialize` tx hangs >5s | Keep narrating. "Solana finalizes in under a second on average — devnet is a bit slower. Here it comes…" If still hung at 15s, refresh the tab, the program-account is fine. |
| Countdown started later than planned (e.g. wizard typo set you back 10s) | Skip the cockpit pause beat, go straight to the tab switch. The countdown beat plays out on `/watch` instead. |
| Phantom popup doesn't appear on ARM IT | The wallet was disconnected — click CONNECT in the WalletPill, then click ARM IT again. |
| WatchClaim doesn't auto-flip to CLAIMABLE | The countdown is `Date.now()`-driven and the tx-state derives from on-chain `unlock_at`. If it sticks, hit `R` in `?demo=1` mode to force a re-fetch. (Don't use `?demo=1` for the real demo — only as a stage-recovery escape.) |
| Whole demo broken (RPC down, Phantom locked out) | Stop. Switch to the **backup recording** (preflight item #12). Narrate over it. |

---

## What you do NOT say

- "It's just a demo." (It's not — txs are real on devnet.)
- "On mainnet it would…" (It already would. Same program, change one URL.)
- "Sorry, the network is slow." (Pause, narrate the wait. Never apologize.)

---

## Why this works as a pitch

The whole arc proves **one** claim: a Solana program enforces a *time* condition without any off-chain agent watching the clock. The cinematic wizard is the sugar — but if a judge asks you to cut to the bone, you can demo the same thing in 30 seconds: arm a switch via the seed script, wait 30 seconds, claim. The fancy UI is replaceable; the time-gated PDA is not.
