// subscribe — public endpoint the frontend calls to register / update / disable
// a reminder subscription for a switch.
//
// Security model: before accepting a subscription we fetch the named switch PDA
// on-chain and confirm its stored `owner` matches the supplied owner_pubkey, so
// you can only attach reminders to a switch that actually exists and whose owner
// you correctly identified. Contact info is then stored server-side (RLS-locked).
//
// Optional hardening: set SUBSCRIBE_REQUIRE_SIGNATURE=true to additionally
// require an ed25519 signature from the owner over `message`, proving the caller
// holds the owner key (not just knows its pubkey). Off by default for demo ease.
//
// verify_jwt is disabled; this function is intentionally public (with the
// on-chain ownership check above as the gate). Uses the service-role key to
// write, which bypasses RLS.

import { createClient } from "npm:@supabase/supabase-js@2";
import bs58 from "npm:bs58@5";
import nacl from "npm:tweetnacl@1";

const DEFAULT_RPC = "https://api.devnet.solana.com";
const OFF_OWNER = 8; // owner pubkey starts right after the 8-byte discriminator
const MIN_LEN = 97;

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
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
  if (!value) return null;
  const bin = atob(value.data[0] as string);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }

  const switch_pda = String(body.switch_pda ?? "").trim();
  const owner_pubkey = String(body.owner_pubkey ?? "").trim();
  const email = body.email ? String(body.email).trim() : null;
  const telegram_chat_id = body.telegram_chat_id ? String(body.telegram_chat_id).trim() : null;
  const enabled = body.enabled === undefined ? true : Boolean(body.enabled);

  // sane defaults + bounds for owner-chosen cadence
  const lead_seconds = Math.max(1, Math.min(7 * 24 * 3600, Number(body.lead_seconds ?? 3600)));
  const frequency_seconds = Math.max(30, Math.min(24 * 3600, Number(body.frequency_seconds ?? 900)));

  if (!switch_pda || !owner_pubkey) {
    return json({ error: "switch_pda and owner_pubkey are required" }, 400);
  }
  if (!email && !telegram_chat_id) {
    return json({ error: "provide at least one of email or telegram_chat_id" }, 400);
  }

  const rpc = Deno.env.get("SOLANA_RPC_URL") ?? DEFAULT_RPC;

  // 1) ownership check against live chain state
  let bytes: Uint8Array | null;
  try {
    bytes = await rpcGetAccount(rpc, switch_pda);
  } catch (e) {
    return json({ error: `RPC error: ${e instanceof Error ? e.message : e}` }, 502);
  }
  if (bytes === null) return json({ error: "switch PDA not found on-chain" }, 404);
  if (bytes.length < MIN_LEN) return json({ error: "account is not a Switch" }, 400);

  const onchainOwner = bs58.encode(bytes.slice(OFF_OWNER, OFF_OWNER + 32));
  if (onchainOwner !== owner_pubkey) {
    return json({ error: "owner_pubkey does not match the switch's on-chain owner" }, 403);
  }

  // 2) optional ed25519 signature gate (proves possession of the owner key)
  if ((Deno.env.get("SUBSCRIBE_REQUIRE_SIGNATURE") ?? "").toLowerCase() === "true") {
    const message = body.message ? String(body.message) : "";
    const signature = body.signature ? String(body.signature) : "";
    if (!message || !signature) {
      return json({ error: "signature and message required" }, 401);
    }
    try {
      const ok = nacl.sign.detached.verify(
        new TextEncoder().encode(message),
        bs58.decode(signature),
        bs58.decode(owner_pubkey),
      );
      if (!ok) return json({ error: "bad signature" }, 401);
    } catch {
      return json({ error: "malformed signature/message" }, 401);
    }
  }

  // 3) upsert (one subscription per switch_pda)
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { error } = await supabase
    .from("reminder_subscriptions")
    .upsert(
      {
        switch_pda,
        owner_pubkey,
        email,
        telegram_chat_id,
        lead_seconds,
        frequency_seconds,
        enabled,
        // reset bookkeeping so the next tick re-evaluates cleanly
        last_unlock_at: null,
        last_notified_at: null,
        claimable_notified: false,
      },
      { onConflict: "switch_pda" },
    );
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true, switch_pda, enabled, lead_seconds, frequency_seconds });
});
