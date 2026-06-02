import { clusterApiUrl } from "@solana/web3.js";

/**
 * Devnet RPC endpoint for the whole app.
 *
 * Reads `VITE_RPC_URL` (e.g. a Helius/QuickNode devnet URL) so the live demo
 * doesn't depend on the rate-limited public `api.devnet.solana.com`. Falls back
 * to the public endpoint when the env var is unset (local dev, CI).
 *
 * Set it in `app/.env.local`:
 *   VITE_RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_KEY
 */
export const RPC_ENDPOINT: string =
  (import.meta.env.VITE_RPC_URL as string | undefined)?.trim() ||
  clusterApiUrl("devnet");

/** True when a custom (non-public) RPC is configured — handy for a console hint. */
export const USING_CUSTOM_RPC = Boolean(
  (import.meta.env.VITE_RPC_URL as string | undefined)?.trim(),
);
