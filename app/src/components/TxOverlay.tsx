/**
 * Full-screen transaction-flow overlay. Distinguishes on-chain (green)
 * from off-chain Supabase calls (amber).
 */
interface Props {
  fnName: string;
  sub?: string;
  variant?: "onchain" | "offchain";
}

export function TxOverlay({ fnName, sub, variant = "onchain" }: Props) {
  const c = variant === "offchain" ? "#FFB020" : "#00FF88";
  const tag = variant === "offchain" ? "POST · /functions/v1/subscribe" : "SIGNING TRANSACTION";
  const floodBg =
    variant === "offchain"
      ? "rgba(255,176,32,.4)"
      : "rgba(0,255,136,.4)";

  return (
    <>
      <div
        aria-hidden
        className="fixed inset-0 z-[150] pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at center, ${floodBg}, transparent 70%)`,
          animation: "floodIn 700ms ease-out",
        }}
      />
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-0 z-[200] flex items-center justify-center flex-col gap-6 bg-black/95 font-mono px-6"
      >
        <div className="text-[0.65rem] tracking-[0.32em] text-muted">{tag}</div>
        <div
          className="text-3xl font-extrabold"
          style={{ color: c, textShadow: `0 0 24px ${c}` }}
        >
          {fnName}()<span className="animate-blink">_</span>
        </div>
        {sub && <div className="text-sm text-muted max-w-md text-center leading-relaxed">{sub}</div>}
        <div className="h-0.5 w-52 bg-border relative overflow-hidden">
          <div
            className="h-full"
            style={{
              width: 0,
              background: c,
              boxShadow: `0 0 12px ${c}`,
              animation: "txProgress 1400ms ease forwards",
            }}
          />
        </div>
      </div>
      <style>{`
        @keyframes txProgress { to { width: 100%; } }
        @keyframes floodIn { from { opacity: 1; } to { opacity: 0; } }
      `}</style>
    </>
  );
}
