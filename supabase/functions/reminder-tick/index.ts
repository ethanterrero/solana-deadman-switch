// reminder-tick — the advisory notifier.
//
// Runs on a schedule (pg_cron -> pg_net -> this function). For every enabled
// subscription it reads the live on-chain Switch account, computes how long
// until the switch unlocks, and — if the owner is inside their chosen warning
// window — sends an email (Resend) and/or Telegram ping. It is the ONLY moving
// off-chain part of the system and it is purely advisory: it never touches
// funds and the on-chain `claim` time-gate stands on its own.
//
// Auth: protected by a shared secret in the `x-cron-secret` header (the cron job
// passes it). verify_jwt is disabled for this function.
//
// Required secrets (Edge Function env):
//   CRON_SECRET              shared secret, must match the pg_cron caller
//   RESEND_API_KEY           (optional) enables email delivery
//   RESEND_FROM              (optional) e.g. "Dead Man's Switch <reminders@yourdomain>"
//   TELEGRAM_BOT_TOKEN       (optional) enables Telegram delivery
//   SOLANA_RPC_URL           (optional) defaults to devnet
// Auto-injected by the platform: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "npm:@supabase/supabase-js@2";

const PROGRAM_ID = "6gbTnghr3AXPbCTjieq3veCmt656ALbEd7VUGX9z5fFu";
const DEFAULT_RPC = "https://api.devnet.solana.com";

// Switch account layout (Anchor): 8 disc | 32 owner | 32 beneficiary |
// 8 last_checkin (i64 LE) | 8 interval (i64 LE) | 8 amount (u64 LE) | 1 bump
const OFF_LAST_CHECKIN = 8 + 32 + 32; // 72
const OFF_INTERVAL = OFF_LAST_CHECKIN + 8; // 80
const MIN_LEN = 8 + 32 + 32 + 8 + 8 + 8 + 1; // 97

type Sub = {
  id: string;
  switch_pda: string;
  owner_pubkey: string;
  email: string | null;
  telegram_chat_id: string | null;
  lead_seconds: number;
  frequency_seconds: number;
  last_unlock_at: number | null;
  last_notified_at: string | null;
  claimable_notified: boolean;
};

function explorer(addr: string): string {
  return `https://explorer.solana.com/address/${addr}?cluster=devnet`;
}

function fmtDuration(secs: number): string {
  secs = Math.max(0, Math.floor(secs));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

async function rpcGetAccount(rpc: string, pubkey: string): Promise<Uint8Array | null> {
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getAccountInfo",
      params: [pubkey, { encoding: "base64", commitment: "confirmed" }],
    }),
  });
  if (!res.ok) throw new Error(`RPC ${res.status}`);
  const json = await res.json();
  const value = json?.result?.value;
  if (!value) return null; // account does not exist (closed / never created)
  const b64 = value.data[0] as string;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function decodeUnlock(bytes: Uint8Array): number {
  if (bytes.length < MIN_LEN) throw new Error("account too small to be a Switch");
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const lastCheckin = dv.getBigInt64(OFF_LAST_CHECKIN, true);
  const interval = dv.getBigInt64(OFF_INTERVAL, true);
  return Number(lastCheckin + interval); // unix seconds
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM");
  if (!key || !from) return; // email channel not configured; silently skip
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

async function sendTelegram(chatId: string, text: string): Promise<void> {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!token) return; // telegram channel not configured; silently skip
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) throw new Error(`Telegram ${res.status}: ${await res.text()}`);
}

Deno.serve(async (req: Request) => {
  // shared-secret gate
  const expected = Deno.env.get("CRON_SECRET");
  if (!expected || req.headers.get("x-cron-secret") !== expected) {
    return new Response("unauthorized", { status: 401 });
  }

  const rpc = Deno.env.get("SOLANA_RPC_URL") ?? DEFAULT_RPC;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: subs, error } = await supabase
    .from("reminder_subscriptions")
    .select("*")
    .eq("enabled", true)
    .returns<Sub[]>();
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const now = Math.floor(Date.now() / 1000);
  let checked = 0;
  let notified = 0;
  let disabled = 0;
  const errors: string[] = [];

  for (const sub of subs ?? []) {
    checked++;
    try {
      const bytes = await rpcGetAccount(rpc, sub.switch_pda);

      // Switch closed (claimed or cancelled): nothing left to remind about.
      if (bytes === null) {
        await supabase
          .from("reminder_subscriptions")
          .update({ enabled: false })
          .eq("id", sub.id);
        disabled++;
        continue;
      }

      const unlock = decodeUnlock(bytes);
      const timeLeft = unlock - now;

      // New window? Owner checked in or changed the interval since we last looked.
      const patch: Record<string, unknown> = {};
      let lastNotifiedAt = sub.last_notified_at;
      let claimableNotified = sub.claimable_notified;
      if (sub.last_unlock_at === null || sub.last_unlock_at !== unlock) {
        patch.last_unlock_at = unlock;
        patch.last_notified_at = null;
        patch.claimable_notified = false;
        lastNotifiedAt = null;
        claimableNotified = false;
      }

      const unlockIso = new Date(unlock * 1000).toISOString();
      const link = explorer(sub.switch_pda);

      if (timeLeft <= 0) {
        // Funds are claimable now — send a one-shot final notice.
        if (!claimableNotified) {
          const subject = "Your dead man's switch has UNLOCKED";
          const html =
            `<p>The check-in window for your switch has elapsed. Your beneficiary can now claim the funds.</p>` +
            `<p>If this is unexpected, there is nothing more to do — the window has passed.</p>` +
            `<p>Switch: <a href="${link}">${sub.switch_pda}</a></p>`;
          const text =
            `⚠️ Your dead man's switch has UNLOCKED. The beneficiary can now claim.\n${link}`;
          if (sub.email) await sendEmail(sub.email, subject, html);
          if (sub.telegram_chat_id) await sendTelegram(sub.telegram_chat_id, text);
          patch.claimable_notified = true;
          notified++;
        }
      } else if (timeLeft <= sub.lead_seconds) {
        // Inside the warning window — fire if enough time since the last reminder.
        const sinceLast = lastNotifiedAt
          ? (now - Math.floor(new Date(lastNotifiedAt).getTime() / 1000))
          : Infinity;
        if (sinceLast >= sub.frequency_seconds) {
          const left = fmtDuration(timeLeft);
          const subject = `Check in: your switch unlocks in ${left}`;
          const html =
            `<p>Your dead man's switch unlocks in <b>${left}</b> (at ${unlockIso}).</p>` +
            `<p><b>Check in now</b> to reset the timer and keep your funds locked.</p>` +
            `<p>Switch: <a href="${link}">${sub.switch_pda}</a></p>`;
          const text =
            `⏳ Your dead man's switch unlocks in ${left} (at ${unlockIso}). ` +
            `Check in now to reset the timer.\n${link}`;
          if (sub.email) await sendEmail(sub.email, subject, html);
          if (sub.telegram_chat_id) await sendTelegram(sub.telegram_chat_id, text);
          patch.last_notified_at = new Date(now * 1000).toISOString();
          notified++;
        }
      }

      if (Object.keys(patch).length > 0) {
        await supabase.from("reminder_subscriptions").update(patch).eq("id", sub.id);
      }
    } catch (e) {
      errors.push(`${sub.switch_pda}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return new Response(
    JSON.stringify({ ok: true, checked, notified, disabled, errors }),
    { headers: { "content-type": "application/json" } },
  );
});
