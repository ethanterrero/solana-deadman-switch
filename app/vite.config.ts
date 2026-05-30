import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Buffer / process polyfills for Solana web3.js in the browser
export default defineConfig({
  plugins: [react()],
  define: {
    "process.env": {},
    global: "globalThis",
  },
  resolve: {
    alias: {
      // wallet-adapter-base touches process.env
    },
  },
  server: {
    port: 5173,
  },
});
