/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      colors: {
        bg: "#000000",
        panel: "#0a0a0a",
        "panel-2": "#0f0f0f",
        border: "#1f1f1f",
        green: {
          DEFAULT: "#00ff88",
          dim: "#00aa5a",
        },
        amber: {
          DEFAULT: "#ffb020",
          dim: "#b87a14",
        },
        orange: "#ff7a18",
        red: {
          DEFAULT: "#ff3355",
          deep: "#cc1f3f",
        },
        violet: {
          DEFAULT: "#a78bfa",
          deep: "#7c3aed",
        },
        text: "#e8e8e8",
        muted: "#9a9a9a",
        "muted-deep": "#6a6a6a",
      },
      animation: {
        blink: "blink 1.2s steps(2, jump-none) infinite",
        "blink-slow": "blink 2.2s steps(2, jump-none) infinite",
        heartbeat: "heartbeat var(--tick-speed, 2200ms) ease-in-out infinite",
        "fade-in": "fadeIn 700ms cubic-bezier(.2,.7,.2,1) forwards",
        "slide-l": "slideL 700ms cubic-bezier(.2,.7,.2,1) forwards",
        "slide-r": "slideR 700ms cubic-bezier(.2,.7,.2,1) forwards",
        "pulse-red": "pulseRed 1.4s ease-in-out infinite",
      },
      keyframes: {
        blink: { "50%": { opacity: "0.18" } },
        heartbeat: {
          "0%,60%,100%": { transform: "scale(1)", opacity: "1" },
          "20%": { transform: "scale(1.5)", opacity: "0.7" },
          "30%": { transform: "scale(1)", opacity: "1" },
          "45%": { transform: "scale(1.3)", opacity: "0.85" },
        },
        fadeIn: { to: { opacity: "1" } },
        slideL: { to: { opacity: "1", transform: "translateX(0)" } },
        slideR: { to: { opacity: "1", transform: "translateX(0)" } },
        pulseRed: {
          "0%,100%": { boxShadow: "0 0 0 rgba(255,51,85,0)" },
          "50%": {
            boxShadow:
              "0 0 50px rgba(255,51,85,.5), inset 0 0 16px rgba(255,51,85,.15)",
          },
        },
      },
    },
  },
  plugins: [],
};
