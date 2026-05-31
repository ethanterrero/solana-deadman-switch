/**
 * The "vault is alive" pulse — sized + cadence pulled from CSS custom properties
 * so it slows in ACTIVE and accelerates in CRITICAL/EXPIRED states.
 */
export function HeartbeatDot() {
  return (
    <span
      aria-hidden
      className="inline-block w-2 h-2 rounded-full animate-heartbeat"
      style={{
        background: "var(--status)",
        boxShadow: "0 0 10px var(--status)",
      }}
    />
  );
}
