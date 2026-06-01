# app/ — Dead Man's Switch frontend

Vite + React + TypeScript. Walks the full 5-screen Cinematic Wizard flow in Terminal Vault style.

## Run

```bash
cd app
npm install   # ~3 min — Solana dep tree is heavy
npm run dev
# open http://localhost:5173
```

## Stack

- **Vite** — dev server + bundler
- **React 18 + TS** — strict mode
- **React Router** — `/`, `/identify`, `/arm`, `/cockpit`, `/watch`
- **Tailwind v3** — design tokens in `tailwind.config.cjs` + `src/index.css`
- **@solana/wallet-adapter-react** — Phantom + Solflare wallets, devnet
- **@coral-xyz/anchor** — typed program client (IDL imported from `../target/idl/`)

## Routes

| Path | Page | Notes |
|---|---|---|
| `/` | `ColdOpen` | manifesto + INITIATE — pre-wallet |
| `/identify` | `Identify` | OWNER / BENEFICIARY role select |
| `/arm` | `ArmVault` | 5-step wizard (beneficiary → interval → amount → oath → reminders) |
| `/cockpit` | `Cockpit` | active vault: countdown + CHECK_IN + deposit/edit/reminders/cancel modals |
| `/watch` | `WatchClaim` | beneficiary watch + claim (empty → watching → nearing → claimable → claimed) |

## Demo flags

- `?demo=1` on `/cockpit` or `/watch` — reveals the state-preview toggle in the topbar (hidden by default so you can't accidentally click it on stage)
- `?existing=1` on `/arm` — previews the "switch already exists" banner that would normally come from `getAccountInfo(switchPda)` returning non-null

## What's wired vs mocked

**Wired (real, on devnet):**
- Wallet adapter (Phantom, Solflare); WalletPill polls live SOL balance every 15s
- Typed Anchor client — `useProgram()` builds `Program<DeadmanSwitch>` from the
  connected wallet (read-only stand-in before connect so account fetches work).
- **All six instructions** via `src/lib/anchor.ts`:
  `initialize`, `check_in`, `deposit`, `update_config`, `claim`, `cancel` —
  each sends a real tx and the cockpit refetches the `Switch` account after.
- **Switch account fetch + decode** — the cockpit derives its countdown/status
  from the real `last_checkin + interval`; the beneficiary screen looks a vault
  up by owner address (`getAccountInfo` on the PDA).
- **Supabase `subscribe` POST** — wizard step 5 + the cockpit reminders modal
  hit `/functions/v1/subscribe` for real.
- Write actions gate on a connected signer (open the wallet modal if absent);
  errors surface in an `ErrorToast`; `Date.now()`-based drift-free countdown.

**Still mocked / simplified:**
- Activity feed is session-local (pushes real tx signatures as actions happen),
  not yet a live `program.addEventListener` subscription.
- Beneficiary auto-discover (`getProgramAccounts` filtered by `beneficiary`) is
  still a paste-the-owner-address flow.
- The deposit modal's wallet-balance figure is a placeholder.

The `?demo=1` state toggles (cockpit/watch) drive synthetic countdowns for
rehearsal without waiting for a real interval to elapse.

## Accessibility

- WCAG-passing contrast (`--muted: #9a9a9a`)
- `:focus-visible` rings on every interactive class
- `prefers-reduced-motion` honored everywhere (typewriter, breathing pulses, white-flash, heartbeat)
- Modal focus trap + ESC + return-focus-on-close
- Touch targets ≥44px

## Polish applied during port

- **Vault glyph** swapped from generic lock-in-circle to a heartbeat-pulse-line inside a vault — ties thematically to *dead man's switch* (a thing you have to keep holding to keep alive)
- **Countdown is drift-free**: recomputes from `Date.now()` each tick (fixes the static mockup's `setInterval(1000)` drift)
- **Modal focus trap** — Tab cycles inside the modal, ESC closes, focus restores to the trigger
- **State now lives in React** (URL params only carry wizard → cockpit handoff for demo continuity)
- **Component decomposition**: `<Shell>`, `<WalletPill>`, `<Countdown>`, `<StatusBadge>`, `<Modal>`, `<TxOverlay>`, `<Field>`, `<PresetGroup>`, `<VaultGlyph>`, `<HeartbeatDot>`, `<Button>`, etc.

## Next

- Event subscription for live activity feed (`program.addEventListener('Deposited', ...)`)
- Modal focus polish (some modals still need `aria-describedby`)
- `getProgramAccounts` filter for beneficiary auto-discover on `/watch`
