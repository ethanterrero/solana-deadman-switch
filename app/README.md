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

**Wired:**
- Wallet adapter (Phantom, Solflare)
- WalletPill polls live SOL balance every 15s
- Date.now()-based countdown (drift-free)
- Wallet modal opens via "CONNECT WALLET" CTA

**Mocked (with `// TODO: real Anchor call` markers):**
- All program instructions (`initialize`, `check_in`, `deposit`, `update_config`, `claim`, `cancel`)
- Switch account fetch / event subscription
- Supabase `subscribe` POST
- Activity feed (in-memory)

Real wiring lands in a follow-up PR. The visual flow is complete.

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

- Real Anchor instruction wiring (replace `// TODO` markers in each page)
- Event subscription for live activity feed (`program.addEventListener('Deposited', ...)`)
- Real Supabase `subscribe` POST
- Modal focus polish (some modals still need `aria-describedby`)
- `getProgramAccounts` filter for beneficiary auto-discover on `/watch`
