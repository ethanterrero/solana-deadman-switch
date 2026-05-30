# Two-Device Work Split

You have two machines. This doc says exactly who does what, when they sync, and what each side can do in parallel without blocking on the other.

> Naming convention below: **Device A** = "program box" (Solana toolchain). **Device B** = "frontend box" (Node only). Pick whichever physical machine has the better Rust install for A.

---

## Why this split works
- Different file trees: `programs/` + `tests/` (A) vs. `app/` (B). Near-zero merge conflicts.
- Different toolchains: A needs Anchor + Solana CLI. B only needs Node.
- One hard handoff point: the **IDL + program ID**. Until that exists, Device B mocks it.

---

## Device A — Program owner (~4.25 hr critical-path work)

**Owns:** `programs/`, `tests/`, `Anchor.toml`, deployment, devnet wallets.

| Phase | Task | Output |
|---|---|---|
| 0 | Install anchor via `avm`, set devnet, generate two keypairs, airdrop, `anchor init` overlay, stock deploy | Working program ID, two funded wallets |
| 1 | Write the 4 instructions per Appendix scaffold; commit IDL | `programs/deadman-switch/src/lib.rs` + `target/idl/deadman_switch.json` |
| 2 | Anchor tests with short interval + sleep | `anchor test` green |
| 4 | Run terminal-side fallback demo + record video | `demo-backup.mp4` |

### Critical Device A handoff
After Phase 1 builds clean, push **immediately**:
```bash
git add Anchor.toml target/idl/deadman_switch.json programs/
git commit -m "phase 1: program shipped, IDL frozen"
git push
```
Then ping Device B. Device B has been working off a hand-written type stub until this lands.

---

## Device B — Frontend + submission owner (~3.5 hr critical-path work)

**Owns:** `app/`, demo polish, README, submission form.

| Phase | Task | Blocked by Device A? |
|---|---|---|
| 3a | Vite + React + TS scaffold, install wallet adapter, build wallet connect UI, balance display, form shell | **No** — start immediately |
| 3b | Hand-write a type stub matching the `Switch` account from `PLAN.md`. Wire UI to a stub client | **No** |
| 3c | Replace stub with real IDL + program ID once Device A pushes | **Yes** — needs A Phase 1 done |
| 3d | Status panel, countdown, LOCKED/CLAIMABLE badge, color flip | No (just polish on real client) |
| 4 | Write demo script, rehearse, record happy-path video from browser | No |
| 5 | README polish, submission form, tag release | No |

### Suggested Device B `app/` skeleton to build pre-handoff
```
app/
├── src/
│   ├── App.tsx                # routes + wallet adapter provider
│   ├── components/
│   │   ├── WalletBar.tsx      # pubkey, balance, connect button
│   │   ├── InitForm.tsx       # beneficiary, interval, amount
│   │   ├── StatusPanel.tsx    # reads Switch account, shows countdown + badge
│   │   └── ActionButtons.tsx  # init / check_in / claim / cancel
│   ├── lib/
│   │   ├── program.ts         # Anchor Program instance, PDA derivation
│   │   └── types.ts           # Switch state type (stub first, IDL-generated later)
│   └── main.tsx
├── package.json
└── vite.config.ts
```

Device B can fully build this *before* Device A has a deployed program — just point at a placeholder program ID, mock the account fetch, and the LOCKED/CLAIMABLE badge will toggle from a fake `last_checkin` until the real client is plugged in.

---

## Sync protocol

- **Branching:** work on `main`. Two parallel directories = no real conflicts. Rebase rather than merge if you must.
- **Commit cadence:** push every time you cross a phase boundary so the other device can pull and review.
- **Shared state to NEVER commit:** keypair JSONs, `.env`. Already gitignored.
- **Shared state to ALWAYS commit:** `target/idl/deadman_switch.json` (so Device B doesn't need Anchor). Note the `.gitignore` already whitelists this path.

---

## Suggested timeline (8-hour window)

```
hour 0  ─ A: phase 0 setup             | B: phase 3a Vite scaffold + wallet adapter
hour 1  ─ A: phase 1 writing program   | B: phase 3a continues, hand-write type stub
hour 2  ─ A: phase 1 finishes, push    | B: phase 3b stub-wired UI
hour 3  ─ A: phase 2 tests             | B: phase 3c pull real IDL, swap in
hour 4  ─ A: tests green               | B: phase 3d status panel + countdown
hour 5  ─ A: backup terminal recording | B: full lifecycle browser test
hour 6  ─ both: demo script + rehearse
hour 7  ─ both: rehearse #2, polish
hour 8  ─ B: README + submission form
```

---

## Failure modes to watch for

- **Device B can't import the IDL** → make sure A's `.gitignore` whitelist for `target/idl/` and `target/types/` worked. Both devices: `git ls-files target/` should list the IDL.
- **Program ID mismatch** → after first real `anchor deploy`, update `declare_id!` + `Anchor.toml`, **rebuild**, redeploy, recommit IDL. Then B re-pulls.
- **Devnet flake** → don't redo wallets on stage. Pre-funded wallets in `keypairs/` (gitignored) on both devices.
- **Clock drift on Solana** → use 30s interval for demo, not 5s. Test interval can stay short.
