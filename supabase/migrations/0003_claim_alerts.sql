-- Two-phase claim support for `reminder-tick`.
--
-- When the beneficiary calls `start_claim`, the owner has a challenge window to
-- veto by checking in. reminder-tick alerts the owner immediately and then on
-- their usual frequency until the claim is vetoed or finished.
--
--   claim_alert_for   the on-chain claim_started_at we last alerted about; a new
--                     value means a fresh claim, so the first alert ignores the
--                     frequency throttle.

alter table public.reminder_subscriptions
  add column if not exists claim_alert_for bigint;
