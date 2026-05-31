/**
 * VaultGlyph — polished from the static-mockup "lock-in-a-circle" to something
 * that actually means *dead man's switch*: a vault outline with a heartbeat-pulse
 * line tracking through it. The line ticks (an EKG trace) while the dual rings
 * rotate slowly in opposite directions.
 *
 * Sized via `size` prop. Color via `tone` ("green" | "violet"); defaults to green.
 */

interface Props {
  size?: number;
  tone?: "green" | "violet";
  /** Disable the rotation (e.g., when prefers-reduced-motion). */
  still?: boolean;
}

export function VaultGlyph({ size = 140, tone = "green", still }: Props) {
  const color = tone === "violet" ? "#a78bfa" : "#00FF88";
  return (
    <div
      style={{
        width: size,
        height: size,
        filter: `drop-shadow(0 0 24px ${color}73) drop-shadow(0 0 64px ${color}40)`,
      }}
    >
      <svg viewBox="0 0 100 100" fill="none" style={{ width: "100%", height: "100%" }}>
        {/* Outer ring */}
        <circle cx="50" cy="50" r="46" stroke={color} strokeWidth="0.6" opacity="0.35" />

        {/* Slow rotating tick marks (outer) */}
        <g
          stroke={color}
          strokeWidth="0.7"
          opacity="0.55"
          style={
            still
              ? undefined
              : {
                  transformOrigin: "50% 50%",
                  animation: "spinSlow 22s linear infinite",
                }
          }
        >
          <line x1="50" y1="2" x2="50" y2="11" />
          <line x1="50" y1="89" x2="50" y2="98" />
          <line x1="2" y1="50" x2="11" y2="50" />
          <line x1="89" y1="50" x2="98" y2="50" />
          <line x1="16" y1="16" x2="22" y2="22" />
          <line x1="78" y1="78" x2="84" y2="84" />
          <line x1="78" y1="22" x2="84" y2="16" />
          <line x1="16" y1="84" x2="22" y2="78" />
        </g>

        {/* Reverse-rotating dashed inner ring */}
        <circle
          cx="50"
          cy="50"
          r="38"
          stroke={color}
          strokeWidth="0.8"
          opacity="0.5"
          strokeDasharray="2 6"
          style={
            still
              ? undefined
              : {
                  transformOrigin: "50% 50%",
                  animation: "spinSlow 36s linear infinite reverse",
                }
          }
        />

        {/* Vault outline */}
        <rect x="32" y="38" width="36" height="32" stroke={color} strokeWidth="1.2" />

        {/* Heartbeat / EKG trace through the vault interior */}
        <path
          d="M 34 54 L 40 54 L 42 48 L 45 60 L 48 44 L 50 54 L 56 54 L 58 50 L 60 54 L 66 54"
          stroke={color}
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          style={
            still
              ? undefined
              : {
                  animation: "heartbeatLine 2.4s ease-in-out infinite",
                  transformOrigin: "center",
                }
          }
        />

        {/* Small lock body on top of vault */}
        <rect x="44" y="30" width="12" height="10" stroke={color} strokeWidth="1.2" fill="none" />
        <path
          d="M46 30 v-4 a4 4 0 0 1 8 0 v4"
          stroke={color}
          strokeWidth="1.2"
          fill="none"
          strokeLinejoin="round"
        />
        <circle cx="50" cy="35.5" r="1.6" fill={color} />

        <style>{`
          @keyframes spinSlow {
            to { transform: rotate(360deg); }
          }
          @keyframes heartbeatLine {
            0%, 60%, 100% { opacity: 0.4; }
            20% { opacity: 1; }
            45% { opacity: 0.7; }
          }
          @media (prefers-reduced-motion: reduce) {
            g, circle, path { animation: none !important; opacity: 1 !important; }
          }
        `}</style>
      </svg>
    </div>
  );
}
