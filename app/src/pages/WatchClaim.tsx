import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shell } from "../components/Shell";
import { Stamp } from "../components/Stamp";
import { BackLink } from "../components/BackLink";
import { WalletPill } from "../components/WalletPill";
import { Field } from "../components/Field";
import { Button } from "../components/Button";
import { Countdown } from "../components/Countdown";
import { StatusBadge } from "../components/StatusBadge";
import { TxOverlay } from "../components/TxOverlay";
import { VaultGlyph } from "../components/VaultGlyph";
import { useDemoFlag } from "../hooks/useDemoFlag";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { fmtUtc, shortAddr } from "../lib/format";

type WatchState = "empty" | "watching" | "nearing" | "claimable" | "claimed";

export function WatchClaim() {
  const navigate = useNavigate();
  const demo = useDemoFlag();
  const reduced = useReducedMotion();

  const [state, setState] = useState<WatchState>("empty");
  const [ownerInput, setOwnerInput] = useState(
    "7xK4NqRsTpVwXyZ1AbCdEfGhJkLmNpQrStUw9V8MzPq2",
  );
  const [ownerAddr, setOwnerAddr] = useState("");
  const [unlockAtMs, setUnlockAtMs] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [showFlash, setShowFlash] = useState(false);

  function loadVault() {
    if (ownerInput.length < 32) return;
    setLoading(true);
    setOwnerAddr(ownerInput);
    // TODO: derive PDA from owner pubkey, getAccountInfo, decode Switch
    setTimeout(() => {
      setLoading(false);
      setState("watching");
      // 11d 23h 47m 12s from now
      setUnlockAtMs(Date.now() + (11 * 86400 + 23 * 3600 + 47 * 60 + 12) * 1000);
    }, 1200);
  }

  function setPreviewState(s: WatchState) {
    if (s === "empty") {
      setUnlockAtMs(null);
    } else if (s === "watching") {
      setOwnerAddr(ownerInput);
      setUnlockAtMs(Date.now() + (11 * 86400 + 23 * 3600 + 47 * 60 + 12) * 1000);
    } else if (s === "nearing") {
      setOwnerAddr(ownerInput);
      setUnlockAtMs(Date.now() + 47 * 1000);
    } else if (s === "claimable") {
      setOwnerAddr(ownerInput);
      setUnlockAtMs(Date.now() - 1000);
    } else if (s === "claimed") {
      setOwnerAddr(ownerInput);
      setUnlockAtMs(Date.now() - 60_000);
    }
    setState(s);
  }

  function onCountdownExpire() {
    if (state !== "watching" && state !== "nearing") return;
    if (!reduced) {
      setShowFlash(true);
      setTimeout(() => setShowFlash(false), 800);
    }
    setTimeout(() => setState("claimable"), 250);
  }

  function executeClaim() {
    // TODO: program.methods.claim().accounts({ switch: switchPda, beneficiary: wallet.publicKey }).rpc()
    setClaiming(true);
    setTimeout(() => {
      setClaiming(false);
      setState("claimed");
    }, 2000);
  }

  // Keyboard: SPACE claim if claimable, ENTER load if empty
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === " " || e.code === "Space") && state === "claimable") {
        e.preventDefault();
        executeClaim();
      } else if (e.key === "Enter" && state === "empty") {
        loadVault();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Shell state={state} bodyClass={demo ? "demo-mode" : undefined}>
      <header className="px-10 py-6 flex justify-between items-center flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <BackLink to="/identify" label="EXIT" />
          <WalletPill role="BENEFICIARY" />
        </div>

        {demo && (
          <div className="flex gap-2 p-2 bg-panel border border-border">
            {(["empty", "watching", "nearing", "claimable", "claimed"] as WatchState[]).map(
              (s) => (
                <button
                  key={s}
                  onClick={() => setPreviewState(s)}
                  className={`font-mono text-[0.62rem] tracking-[0.18em] uppercase px-2.5 py-1.5 border transition-all ${
                    state === s
                      ? "bg-panel-2 border-[var(--status)] text-[var(--status)]"
                      : "border-transparent text-muted hover:text-text"
                  }`}
                >
                  {s === "nearing" ? "NEARING <1m" : s.toUpperCase()}
                </button>
              ),
            )}
          </div>
        )}
      </header>

      {/* EMPTY STATE */}
      {state === "empty" && (
        <section>
          <div className="max-w-3xl mx-auto px-6 mt-16 text-center">
            <div className="mx-auto mb-8 inline-block">
              <VaultGlyph size={92} tone="violet" still={reduced} />
            </div>

            <div className="stamp text-violet glow-violet mb-4">WATCH A VAULT</div>
            <h1
              className="font-extrabold text-text leading-tight m-0"
              style={{
                fontSize: "clamp(1.8rem, 4vw, 3rem)",
                letterSpacing: "-0.025em",
              }}
            >
              <span className="text-violet">&gt;</span> WHOSE COUNTDOWN
              <br />
              ARE YOU WATCHING?
              <span className="text-violet animate-blink">_</span>
            </h1>
            <p className="text-muted text-base mt-4 max-w-md mx-auto leading-relaxed">
              enter the wallet address of someone who set a dead man's switch
              with you as beneficiary. we'll show you their countdown — and the
              CLAIM button unlocks when it hits zero.
            </p>

            <div className="max-w-lg mx-auto mt-10 flex flex-col gap-3">
              <Field
                size="big"
                value={ownerInput}
                onChange={(e) => setOwnerInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadVault()}
                placeholder="7xK4Nq...3pQ2"
                className="text-center"
              />
              <button
                onClick={loadVault}
                className="font-mono font-bold uppercase tracking-[0.2em] text-sm px-8 py-4 border-2 border-violet text-violet bg-transparent hover:bg-violet hover:text-black transition-all duration-200 inline-flex items-center justify-center gap-3 cursor-pointer min-h-[44px]"
              >
                LOAD VAULT ▶▶
              </button>
            </div>

            <div className="mt-10 text-xs text-muted max-w-lg mx-auto leading-relaxed">
              <span className="text-green-dim italic">planned:</span>{" "}
              auto-discover all switches naming your wallet as beneficiary via{" "}
              <code className="text-violet">getProgramAccounts</code> filtered by{" "}
              <code className="text-violet">beneficiary == &lt;your wallet&gt;</code>. for the demo, paste an owner address above.
            </div>
          </div>
        </section>
      )}

      {/* WATCHING / NEARING / CLAIMABLE / CLAIMED — share the centered stage */}
      {state !== "empty" && (
        <main className="max-w-5xl mx-auto px-6 py-2">
          {/* Vault info ribbon */}
          <div className="flex items-center justify-center gap-6 px-6 py-3 bg-panel border border-border text-xs tracking-wider flex-wrap mb-8">
            <span>
              <Stamp>WATCHING</Stamp>{" "}
              <span className="text-text">{shortAddr(ownerAddr)}</span>
            </span>
            <span className="text-muted">·</span>
            <span>
              <Stamp>VAULT</Stamp> <span className="text-text">8Hk9...vC3</span>
            </span>
            <span className="text-muted">·</span>
            <span>
              <Stamp>INTERVAL</Stamp> <span className="text-text">30 DAYS</span>
            </span>
          </div>

          <div className="mb-6">
            <StatusBadge
              icon={state === "claimable" ? "●" : state === "claimed" ? "✓" : "◇"}
              sub={
                state === "watching"
                  ? "they're still here"
                  : state === "nearing"
                    ? "any moment now"
                    : state === "claimable"
                      ? "claim before they race"
                      : "vault closed"
              }
            >
              {state === "watching" && "WATCHING · OWNER IS ACTIVE"}
              {state === "nearing" && "NEARING ZERO · STAY READY"}
              {state === "claimable" && "● READY TO CLAIM"}
              {state === "claimed" && "✓ CLAIMED"}
            </StatusBadge>
          </div>

          {state !== "claimed" && (
            <>
              <Stamp className="block text-center mb-3">
                {state === "claimable" ? "" : state === "watching" ? "IF THEY STAY SILENT FOR" : "UNTIL CLAIMABLE"}
              </Stamp>
              {state === "claimable" && (
                <div
                  className="stamp text-center mb-3"
                  style={{ color: "var(--green)", letterSpacing: "0.4em" }}
                >
                  THE OWNER WENT SILENT
                </div>
              )}

              <Countdown
                unlockAtMs={unlockAtMs}
                onExpire={onCountdownExpire}
              />

              {/* Amount block */}
              <div className="text-center mt-10">
                <div className="stamp mb-2.5">
                  {state === "claimable" ? "THIS VAULT IS YOURS" : "THIS WILL BECOME YOURS"}
                </div>
                <div
                  className={`font-extrabold tabular ${
                    state === "claimable" ? "text-green" : "text-green-dim"
                  }`}
                  style={{
                    fontSize: "clamp(3rem, 9vw, 7.5rem)",
                    lineHeight: 0.9,
                    letterSpacing: "-0.03em",
                    textShadow:
                      state === "claimable"
                        ? "0 0 28px rgba(0,255,136,.6), 0 0 80px rgba(0,255,136,.3)"
                        : "0 0 24px rgba(0,170,90,.3)",
                    animation:
                      state === "claimable" && !reduced
                        ? "amountBreathe 1.6s ease-in-out infinite"
                        : undefined,
                  }}
                >
                  5.00 SOL
                </div>
              </div>

              {/* CLAIM button */}
              <div className="flex justify-center mt-12">
                <button
                  onClick={executeClaim}
                  disabled={state !== "claimable"}
                  className="relative inline-flex flex-col items-center justify-center gap-1.5 px-16 py-7 bg-transparent border-2 font-mono font-extrabold tracking-[0.22em] uppercase text-xl transition-all duration-300 min-w-[360px] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px]"
                  style={{
                    borderColor: "var(--status)",
                    color: "var(--status)",
                    borderWidth: state === "claimable" ? 3 : 2,
                    animation:
                      state === "claimable" && !reduced
                        ? "claimBreathe 2s ease-in-out infinite"
                        : "none",
                  }}
                >
                  <span
                    className="absolute top-[-10px] left-[-10px] w-3.5 h-3.5 border-t-2 border-l-2"
                    style={{ borderColor: "var(--status)" }}
                  />
                  <span
                    className="absolute bottom-[-10px] right-[-10px] w-3.5 h-3.5 border-b-2 border-r-2"
                    style={{ borderColor: "var(--status)" }}
                  />
                  <span>
                    {state === "claimable" ? "▸ CLAIM 5.00 SOL" : "◆ CLAIM"}
                  </span>
                  <span className="text-xs tracking-[0.22em] font-medium text-muted-deep">
                    {state === "claimable"
                      ? "press [ space ] or click · 1 tx"
                      : "unlocks at 00:00:00:00"}
                  </span>
                </button>
              </div>

              {state === "claimable" && (
                <div className="max-w-2xl mx-auto bg-red/[.08] border border-red/30 border-l-2 border-l-red px-4 py-3 text-xs text-muted leading-snug flex gap-2.5 mt-6">
                  <span className="text-red text-[0.95rem]">⚠</span>
                  <span>
                    <strong className="text-red">this is a race.</strong> the
                    owner can still <code className="text-text">check_in</code>{" "}
                    to reset the timer before you broadcast. claim quickly —
                    once your tx confirms, the funds are yours.
                  </span>
                </div>
              )}

              {state === "watching" && (
                <>
                  <div className="text-center mt-6 text-sm text-muted">
                    owner last checked in ·{" "}
                    <span className="text-text font-semibold">May 11, 14:23 UTC</span>{" "}
                    <span className="text-green-dim text-xs">tx 4Hk9...8nQ</span>
                  </div>
                  <div className="text-center mt-1 text-sm">
                    unlocks for you ·{" "}
                    <span className="text-violet">{fmtUtc(unlockAtMs ?? Date.now())}</span>
                  </div>
                </>
              )}
            </>
          )}

          {/* CLAIMED state */}
          {state === "claimed" && (
            <div className="max-w-xl mx-auto text-center mt-12">
              <div
                className="w-24 h-24 rounded-full mx-auto mb-8 flex items-center justify-center text-4xl text-green border-2 border-green bg-green/[.08]"
                style={{
                  textShadow: "0 0 24px var(--green)",
                  animation: reduced ? "none" : "claimedPulse 2.4s ease-in-out infinite",
                }}
              >
                ✓
              </div>
              <h2 className="font-extrabold text-2xl text-text">YOU INHERITED THIS VAULT.</h2>
              <p className="text-muted text-sm mt-2">
                the on-chain <code className="text-green">Claimed</code> event
                fired. the switch PDA is now closed — rent reclaimed alongside
                the funds.
              </p>

              <div className="mt-10">
                <div className="stamp mb-2.5">RECEIVED</div>
                <div
                  className="font-extrabold text-green tabular"
                  style={{
                    fontSize: "clamp(3rem, 9vw, 7.5rem)",
                    lineHeight: 0.9,
                    letterSpacing: "-0.03em",
                    textShadow:
                      "0 0 28px rgba(0,255,136,.6), 0 0 80px rgba(0,255,136,.3)",
                  }}
                >
                  5.00 SOL
                </div>
              </div>

              <div className="text-sm text-muted leading-relaxed mt-6">
                from · <span className="text-text font-semibold">{shortAddr(ownerAddr)}</span>
                <br />
                tx ·{" "}
                <a
                  href="https://explorer.solana.com/?cluster=devnet"
                  target="_blank"
                  rel="noreferrer"
                  className="text-green underline underline-offset-2"
                >
                  5fNm9pQrTzWxLkBcDfGhJ7Y2...
                </a>
                <br />
                new balance ·{" "}
                <span className="text-green font-semibold">8.20 SOL</span>
              </div>

              <div className="mt-10">
                <button
                  onClick={() => navigate("/identify")}
                  className="font-mono font-bold uppercase tracking-[0.2em] text-sm px-8 py-3 border-2 border-green-dim text-green-dim hover:border-green hover:text-green min-h-[44px]"
                >
                  ◀ BACK TO IDENTIFY
                </button>
              </div>
            </div>
          )}

          {/* footer */}
          {(state === "watching" || state === "nearing") && (
            <div className="mt-16 pt-5 border-t border-border flex justify-between items-center flex-wrap gap-4">
              <button
                onClick={() => setPreviewState("empty")}
                className="text-[0.7rem] tracking-[0.25em] uppercase text-muted cursor-pointer px-3 py-2 border border-transparent hover:text-text hover:border-border min-h-[36px]"
              >
                ◀ STOP WATCHING · clear this vault
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    alert(
                      "planned: subscribe to a notification for when this vault becomes claimable. lives in the same Supabase reminders table but with role=beneficiary.",
                    )
                  }
                  className="text-[0.7rem] tracking-[0.25em] uppercase text-muted cursor-pointer px-3 py-2 border border-transparent hover:text-text hover:border-border min-h-[36px]"
                >
                  ⌖ ALERT WHEN CLAIMABLE
                </button>
                <button
                  onClick={() =>
                    window.open(
                      "https://explorer.solana.com/?cluster=devnet",
                      "_blank",
                    )
                  }
                  className="text-[0.7rem] tracking-[0.25em] uppercase text-muted cursor-pointer px-3 py-2 border border-transparent hover:text-text hover:border-border min-h-[36px]"
                >
                  VIEW ON EXPLORER ▸
                </button>
              </div>
            </div>
          )}
        </main>
      )}

      {/* The cinematic flash */}
      {showFlash && <div className="flash-white" aria-hidden />}

      {/* Loading overlay (LOAD VAULT) */}
      {loading && (
        <TxOverlay
          fnName="getAccountInfo(switch_pda)"
          variant="offchain"
          sub="derive PDA from owner pubkey → fetch account → decode Switch struct → verify beneficiary == your wallet"
        />
      )}
      {claiming && (
        <TxOverlay
          fnName="claim"
          sub="require now >= last_checkin + interval → transfer lamports → close Switch PDA → emit Claimed event"
        />
      )}

      <style>{`
        @keyframes amountBreathe {
          0%, 100% { text-shadow: 0 0 30px rgba(0,255,136,.5), 0 0 80px rgba(0,255,136,.3); }
          50% { text-shadow: 0 0 60px rgba(0,255,136,.85), 0 0 120px rgba(0,255,136,.55); }
        }
        @keyframes claimBreathe {
          0%, 100% { box-shadow: 0 0 40px rgba(0,255,136,.4), inset 0 0 24px rgba(0,255,136,.06); }
          50% { box-shadow: 0 0 100px rgba(0,255,136,.75), inset 0 0 40px rgba(0,255,136,.15); }
        }
        @keyframes claimedPulse {
          0%, 100% { box-shadow: 0 0 0 rgba(0,255,136,0); }
          50% { box-shadow: 0 0 40px rgba(0,255,136,.3); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="amountBreathe"], [style*="claimBreathe"], [style*="claimedPulse"] {
            animation: none !important;
          }
        }
      `}</style>
    </Shell>
  );
}
