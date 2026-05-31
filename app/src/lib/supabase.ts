// Off-chain Supabase notifier — frontend contract.
// Source of truth: supabase/SETUP.md (subscribe — frontend contract).

const SUPABASE_BASE = "https://evwzkclqfjypefxglylc.supabase.co";

export type SubscribeBody = {
  switch_pda: string;
  owner_pubkey: string;
  email?: string;
  telegram_chat_id?: string;
  lead_seconds?: number;
  frequency_seconds?: number;
  enabled?: boolean;
  // If SUBSCRIBE_REQUIRE_SIGNATURE is on, also include:
  message?: string;
  signature?: string;
};

export type SubscribeResponse = { ok: true } | { ok: false; error: string };

/**
 * POST {switch_pda, owner_pubkey, ...} to /functions/v1/subscribe.
 * The backend verifies owner_pubkey == switch.owner on-chain before
 * upserting into reminder_subscriptions (RLS-locked, service-role only).
 */
export async function subscribe(body: SubscribeBody): Promise<SubscribeResponse> {
  const res = await fetch(`${SUPABASE_BASE}/functions/v1/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: `${res.status} ${res.statusText} ${text}`.trim() };
  }
  return { ok: true };
}

/** Mute reminders for a switch — equivalent to POST with enabled: false. */
export async function unsubscribe(
  switchPda: string,
  ownerPubkey: string,
): Promise<SubscribeResponse> {
  return subscribe({
    switch_pda: switchPda,
    owner_pubkey: ownerPubkey,
    enabled: false,
  });
}
