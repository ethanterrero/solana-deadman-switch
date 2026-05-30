-- Reminder subscriptions for the dead man's switch.
--
-- This table is the ONLY off-chain state in the project. It exists purely so an
-- advisory notifier can email/Telegram the owner before their switch unlocks.
-- It does NOT participate in enforcement: the on-chain `claim` still requires
-- `now >= last_checkin + interval`. If this table (or the whole notifier) is
-- wiped, funds remain exactly as safe as before — reminders are pure UX.
--
-- Contact info (email / telegram) is PII and deliberately lives here, never
-- on-chain (a public ledger is the wrong place for an email address).

create extension if not exists pg_net with schema extensions;

create table if not exists public.reminder_subscriptions (
  id                 uuid primary key default gen_random_uuid(),

  -- Identity: the switch this subscription watches, plus the on-chain owner we
  -- verified at subscribe time. `switch_pda` is unique — one subscription per
  -- switch (re-subscribing upserts).
  switch_pda         text not null unique,
  owner_pubkey       text not null,

  -- Channels. At least one must be present (see constraint).
  email              text,
  telegram_chat_id   text,

  -- Owner-chosen reminder behaviour:
  --   lead_seconds      how long before unlock to START warning (default 1h)
  --   frequency_seconds how often to RE-SEND within the warning window (default 15m)
  lead_seconds       integer not null default 3600 check (lead_seconds > 0),
  frequency_seconds  integer not null default 900  check (frequency_seconds > 0),

  enabled            boolean not null default true,

  -- Bookkeeping maintained by the `reminder-tick` function (never set by clients):
  --   last_unlock_at    the (last_checkin + interval) value we last observed; a
  --                     change means the owner checked in or edited config, so we
  --                     reset the window.
  --   last_notified_at  when we last fired a reminder in the current window
  --   claimable_notified whether we've sent the one-shot "funds are now claimable"
  last_unlock_at     bigint,
  last_notified_at   timestamptz,
  claimable_notified boolean not null default false,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint at_least_one_channel
    check (email is not null or telegram_chat_id is not null)
);

create index if not exists reminder_subscriptions_enabled_idx
  on public.reminder_subscriptions (enabled)
  where enabled;

-- keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''        -- pin search_path (no mutable lookup); now() is in pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists reminder_subscriptions_set_updated_at on public.reminder_subscriptions;
create trigger reminder_subscriptions_set_updated_at
  before update on public.reminder_subscriptions
  for each row execute function public.set_updated_at();

-- Lock the table down. Emails are PII; nothing should read this via the anon or
-- authenticated roles. Both Edge Functions (`subscribe`, `reminder-tick`) use the
-- service-role key, which bypasses RLS. With RLS enabled and zero policies, the
-- anon/auth roles get nothing.
alter table public.reminder_subscriptions enable row level security;
