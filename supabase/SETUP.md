# Reminder notifier — setup & operations

An **off-chain, advisory** notifier for the dead man's switch. It emails / Telegrams
the owner before their switch unlocks so they can check in. It is the only
off-chain component in the project and it is **not** part of enforcement: the
on-chain `claim` still requires `now >= last_checkin + interval`. If this whole
service disappears, funds stay exactly as safe — reminders are pure UX.

## Architecture

```
pg_cron (every minute)
   └─ net.http_post ──▶ Edge Function: reminder-tick
                          ├─ reads each enabled subscription
                          ├─ getAccountInfo(switch_pda) on Solana devnet
                          ├─ unlock = last_checkin + interval  (decoded from raw bytes)
                          └─ if inside the owner's warning window → Resend email + Telegram

Frontend ──▶ Edge Function: subscribe
               ├─ verifies switch exists on-chain AND owner_pubkey == switch.owner
               └─ upserts into reminder_subscriptions (RLS-locked, service-role only)
```

- **Project:** `ethanterrero's Project` — personal org `deadman-switch` (`hoxktihicnmnsibovvei`)
- **Base URL:** `https://hoxktihicnmnsibovvei.supabase.co`
- **Table:** `public.reminder_subscriptions` (RLS enabled, deny-all to anon/auth; only the service-role key in the functions can read/write it — emails are PII)
- **Program watched:** `6gbTnghr3AXPbCTjieq3veCmt656ALbEd7VUGX9z5fFu` (devnet)

## Required secrets (set these before it can deliver)

Set in **Dashboard → Project Settings → Edge Functions → Secrets**, or via CLI:

First, read the live cron secret out of Vault (it is **not** committed to this repo):

```sql
select decrypted_secret from vault.decrypted_secrets where name = 'reminder_cron_secret';
```

Then set the function secrets (substitute `<CRON_SECRET>` with that value):

```bash
supabase secrets set --project-ref hoxktihicnmnsibovvei \
  CRON_SECRET=<CRON_SECRET> \
  RESEND_API_KEY=re_xxxxxxxx \
  "RESEND_FROM=Dead Man's Switch <reminders@yourdomain.com>" \
  TELEGRAM_BOT_TOKEN=123456:ABC-yourbottoken \
  SOLANA_RPC_URL=https://api.devnet.solana.com
```

| Secret | Required? | Notes |
|---|---|---|
| `CRON_SECRET` | **yes** | Must equal the Vault value the cron job passes (`reminder_cron_secret`). Pull it with the SQL above — it is intentionally never written to the repo. Until this is set on the function, every tick returns 401. |
| `RESEND_API_KEY` + `RESEND_FROM` | for email | Without both, email is silently skipped. `RESEND_FROM` must use a Resend-verified domain. |
| `TELEGRAM_BOT_TOKEN` | for Telegram | From @BotFather. Without it, Telegram is silently skipped. |
| `SOLANA_RPC_URL` | optional | Defaults to `https://api.devnet.solana.com`. |
| `SUBSCRIBE_REQUIRE_SIGNATURE` | optional | `true` makes `subscribe` additionally require an ed25519 signature from the owner key (see below). |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | auto | Injected by the platform; do not set. |

> Channels are independent: set up email, Telegram, or both. A subscription must
> have at least one of `email` / `telegram_chat_id`.

## Tuning the reminder cadence (owner-chosen)

Per subscription:
- `lead_seconds` — how far ahead of unlock to **start** warning. Default `3600` (1h, as requested).
- `frequency_seconds` — how often to **re-send** within that window. Default `900` (15m).

So defaults = "start warning 1 hour out, repeat every 15 minutes until they check
in or it unlocks." A one-shot "your switch has UNLOCKED" notice fires once when the
window passes. When the owner checks in, `unlock` moves and the window resets
automatically on the next tick.

## Verify it's working

```bash
# Auth gate (no secret → 401):
curl -i -X POST https://hoxktihicnmnsibovvei.supabase.co/functions/v1/reminder-tick

# Manual tick (after setting CRON_SECRET on the function):
curl -s -X POST https://hoxktihicnmnsibovvei.supabase.co/functions/v1/reminder-tick \
  -H "x-cron-secret: $CRON_SECRET" | jq
# → {"ok":true,"checked":N,"notified":M,"disabled":K,"errors":[]}
```

Inspect cron runs in SQL:
```sql
select jobid, jobname, schedule, active from cron.job;
select status, return_message, start_time from cron.job_run_details order by start_time desc limit 10;
```

## subscribe — frontend contract

`POST https://hoxktihicnmnsibovvei.supabase.co/functions/v1/subscribe`
`Content-Type: application/json` (CORS open; no auth header needed — gated by the
on-chain ownership check)

```jsonc
{
  "switch_pda": "<base58 PDA>",      // required
  "owner_pubkey": "<base58>",        // required; must match switch.owner on-chain
  "email": "owner@example.com",      // optional (>=1 channel required)
  "telegram_chat_id": "123456789",   // optional
  "lead_seconds": 3600,              // optional, default 3600
  "frequency_seconds": 900,          // optional, default 900
  "enabled": true,                   // optional, default true (send false to mute)
  // only if SUBSCRIBE_REQUIRE_SIGNATURE=true:
  "message": "deadman-switch subscribe <switch_pda> <timestamp>",
  "signature": "<base58 ed25519 sig of message by the owner key>"
}
```

Responses: `200 {ok:true,...}` · `403` owner mismatch · `404` switch not found ·
`400` validation · `502` RPC error.

To **unsubscribe / mute**, re-POST the same `switch_pda` with `"enabled": false`.

> Note: the `app/` frontend (Device B) wires a small form to this endpoint. The
> publishable/anon key is **not** needed for `subscribe` (verify_jwt is off); the
> on-chain owner check is the gate.
