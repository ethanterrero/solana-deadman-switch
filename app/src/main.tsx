import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Buffer } from "buffer";
import { App } from "./App";
import { WalletAdapter } from "./providers/WalletAdapter";
import "./index.css";

// @solana/web3.js + spl-token expect Buffer to be available globally in the browser.
// Vite doesn't polyfill Node built-ins by default — this is the lightweight fix.
if (typeof window !== "undefined" && !(window as unknown as { Buffer?: unknown }).Buffer) {
  (window as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WalletAdapter>
      <App />
    </WalletAdapter>
  </StrictMode>,
);
