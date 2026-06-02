/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Devnet RPC endpoint (Helius/QuickNode). Falls back to public devnet when unset. */
  readonly VITE_RPC_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
