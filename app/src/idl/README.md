# `src/idl/` — committed program interface

These two files are **copied** from the Anchor build output so Vite can import
them from inside `app/`:

- `deadman_switch.json` ← `../../target/idl/deadman_switch.json` (runtime IDL)
- `deadman_switch.ts` ← `../../target/types/deadman_switch.ts` (TS type helper)

If the program's interface changes, re-run `anchor build` (Device A) and re-copy:

```bash
cp ../target/idl/deadman_switch.json   src/idl/deadman_switch.json
cp ../target/types/deadman_switch.ts   src/idl/deadman_switch.ts
```

The program ID is pinned inside both (`6gbTnghr3AXPbCTjieq3veCmt656ALbEd7VUGX9z5fFu`).
