/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Devnet RPC endpoint (Helius/QuickNode). Falls back to public devnet when unset. */
  readonly VITE_RPC_URL?: string;
  /** "1" forces the ARM wizard into fast (seconds) mode for live demos. */
  readonly VITE_FAST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
