-- Schedules the reminder-tick edge function to run every minute via pg_cron.
--
-- This was applied to the live project (personal org "deadman-switch" /
-- hoxktihicnmnsibovvei) already. It is committed for reproducibility — if you
-- ever rebuild the project, set the Vault secret then run this.
--
-- The shared secret lives in Vault (not inline in cron.job, so it is not stored
-- in plaintext in the job table). The SAME value must be set as the CRON_SECRET
-- Edge Function secret (see SETUP.md) so reminder-tick accepts the call.

create extension if not exists pg_cron;

-- Replace the placeholder with a real random secret (e.g. `openssl rand -hex 24`)
-- when rebuilding. The live project already has this seeded.
-- select vault.create_secret('<random-secret>', 'reminder_cron_secret',
--   'Shared secret the pg_cron job passes to the reminder-tick edge function');

select cron.schedule(
  'reminder-tick-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://hoxktihicnmnsibovvei.supabase.co/functions/v1/reminder-tick',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'reminder_cron_secret')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- To inspect runs:
--   select jobid, jobname, schedule, active from cron.job;
--   select * from cron.job_run_details order by start_time desc limit 10;
-- To unschedule:
--   select cron.unschedule('reminder-tick-every-minute');
