import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import { Shell } from "../components/Shell";
import { Stamp } from "../components/Stamp";
import { BackLink } from "../components/BackLink";
import { WalletPill } from "../components/WalletPill";
import { Field } from "../components/Field";
import { Button } from "../components/Button";
import { Countdown } from "../components/Countdown";
import { StatusBadge } from "../components/StatusBadge";
import { TxOverlay } from "../components/TxOverlay";
import { ErrorToast } from "../components/ErrorToast";
import { VaultGlyph } from "../components/VaultGlyph";
import { useDemoFlag } from "../hooks/useDemoFlag";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { useProgram } from "../hooks/useProgram";
import {
  CHALLENGE_PERIOD_SECS,
  claim as claimIx,
  fetchSwitch,
  fetchSwitchesForBeneficiary,
  startClaim as startClaimIx,
  SwitchView,
  toView,
  txErrorMessage,
} from "../lib/anchor";
import { deriveSwitchPda } from "../lib/pda";
import { fmtInterval, fmtSeconds, fmtUtc, looksLikeSolanaAddress, shortAddr } from "../lib/format";

// claimable = deadline passed, start_claim available
// challenge = claim started, owner's veto window running
// finalizable = veto window passed, claim available
type WatchState =
  | "empty"
  | "watching"
  | "nearing"
  | "claimable"
  | "challenge"
  | "finalizable"
  | "claimed";

const CHALLENGE_LABEL = fmtSeconds(CHALLENGE_PERIOD_SECS);

function stateFromView(v: SwitchView): WatchState {
  const now = Date.now();
  if (v.claimableAtMs != null) return v.claimableAtMs <= now ? "finalizable" : "challenge";
  const remaining = (v.unlockAtMs - now) / 1000;
  return remaining <= 0 ? "claimable" : remaining < 60 ? "nearing" : "watching";
}

/** The countdown tracks the challenge window once a claim is pending. */
function countdownTarget(v: SwitchView): number {
  return v.claimableAtMs ?? v.unlockAtMs;
}

export function WatchClaim() {
  const navigate = useNavigate();
  const demo = useDemoFlag();
  const reduced = useReducedMotion();
  const { publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const { program, hasSigner } = useProgram();

  const [state, setState] = useState<WatchState>("empty");
  const [ownerInput, setOwnerInput] = useState("");
  const [ownerAddr, setOwnerAddr] = useState("");
  const [view, setView] = useState<SwitchView | null>(null);
  const [discovered, setDiscovered] = useState<SwitchView[] | null>(null);
  const [unlockAtMs, setUnlockAtMs] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Amount shown — real once a vault is loaded, else the demo default.
  const amountSol = view?.amountSol ?? 5.0;

  // Auto-discover every vault naming the connected wallet as beneficiary.
  useEffect(() => {
    if (!publicKey) {
      setDiscovered(null);
      return;
    }
    let cancelled = false;
    fetchSwitchesForBeneficiary(program, publicKey)
      .then((list) => !cancelled && setDiscovered(list.map(toView)))
      .catch((e) => !cancelled && setError(txErrorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [program, publicKey]);

  function showVault(decoded: SwitchView) {
    setView(decoded);
    setOwnerAddr(decoded.owner);
    setUnlockAtMs(countdownTarget(decoded));
    setState(stateFromView(decoded));
  }

  // Re-read the vault after a tx so state reflects the chain, not a guess.
  async function refreshVault(owner: PublicKey) {
    const s = await fetchSwitch(program, owner);
    if (s) showVault(toView(s));
  }

  // Look up the owner's switch on-chain and decode it.
  async function loadVault() {
    const v = ownerInput.trim();
    if (!looksLikeSolanaAddress(v)) {
      setError("Enter a valid Solana wallet address (base58)");
      return;
    }
    let ownerPk: PublicKey;
    try {
      ownerPk = new PublicKey(v);
    } catch {
      setError("That isn't a valid Solana address");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const s = await fetchSwitch(program, ownerPk);
      if (!s) {
        setError("No vault found for that address");
        return;
      }
      showVault(toView(s));
    } catch (e) {
      setError(txErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  // Demo override (?demo=1) — synthetic remaining time, no chain read.
  function setPreviewState(s: WatchState) {
    const demoOwner = ownerInput || "7xK4NqRsTpVwXyZ1AbCdEfGhJkLmNpQrStUw9V8MzPq2";
    if (s === "empty") {
      setUnlockAtMs(null);
    } else if (s === "watching") {
      setOwnerAddr(demoOwner);
      setUnlockAtMs(Date.now() + (11 * 86400 + 23 * 3600 + 47 * 60 + 12) * 1000);
    } else if (s === "nearing") {
      setOwnerAddr(demoOwner);
      setUnlockAtMs(Date.now() + 47 * 1000);
    } else if (s === "claimable") {
      setOwnerAddr(demoOwner);
      setUnlockAtMs(Date.now() - 1000);
    } else if (s === "challenge") {
      setOwnerAddr(demoOwner);
      setUnlockAtMs(Date.now() + CHALLENGE_PERIOD_SECS * 1000);
    } else if (s === "finalizable") {
      setOwnerAddr(demoOwner);
      setUnlockAtMs(Date.now() - 1000);
    } else if (s === "claimed") {
      setOwnerAddr(demoOwner);
      setUnlockAtMs(Date.now() - 60_000);
    }
    setState(s);
  }

  function onCountdownExpire() {
    const next =
      state === "watching" || state === "nearing"
        ? "claimable"
        : state === "challenge"
          ? "finalizable"
          : null;
    if (!next) return;
    if (!reduced) {
      setShowFlash(true);
      setTimeout(() => setShowFlash(false), 800);
    }
    setTimeout(() => setState(next), 250);
  }

  // One button drives both phases: start_claim, then claim after the window.
  function executeClaim() {
    if (state !== "claimable" && state !== "finalizable") return;
    if (!hasSigner || !publicKey) {
      setVisible(true);
      return;
    }
    let ownerPk: PublicKey;
    try {
      ownerPk = new PublicKey(ownerAddr);
    } catch {
      setError("Owner address is invalid");
      return;
    }
    setError(null);
    setClaiming(true);
    const finishing = state === "finalizable";
    (finishing ? claimIx : startClaimIx)(program, ownerPk, publicKey)
      .then(() => (finishing ? setState("claimed") : refreshVault(ownerPk)))
      .catch((e) => setError(txErrorMessage(e)))
      .finally(() => setClaiming(false));
  }

  const actionable = state === "claimable" || state === "finalizable";

  // Keyboard: SPACE claim if actionable, ENTER load if empty
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === " " || e.code === "Space") && actionable) {
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
            {(
              [
                "empty",
                "watching",
                "nearing",
                "claimable",
                "challenge",
                "finalizable",
                "claimed",
              ] as WatchState[]
            ).map(
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

            <div className="mt-10 max-w-lg mx-auto text-left">
              <div className="stamp mb-3 text-center">VAULTS NAMING YOUR WALLET</div>
              {!publicKey && (
                <p className="text-xs text-muted text-center leading-relaxed">
                  connect your wallet to find every vault that names you as
                  beneficiary — no owner address needed.
                </p>
              )}
              {publicKey && discovered == null && (
                <p className="text-xs text-muted text-center">searching…</p>
              )}
              {publicKey && discovered?.length === 0 && (
                <p className="text-xs text-muted text-center leading-relaxed">
                  no vaults name {shortAddr(publicKey.toBase58())} as beneficiary.
                  you can still paste an owner address above.
                </p>
              )}
              {discovered && discovered.length > 0 && (
                <ul className="flex flex-col gap-2">
                  {discovered.map((d) => (
                    <li key={d.owner}>
                      <button
                        onClick={() => showVault(d)}
                        className="w-full flex justify-between items-center gap-3 px-4 py-3 bg-panel border border-border hover:border-violet text-sm cursor-pointer min-h-[44px]"
                      >
                        <span className="text-text">
                          <Stamp>OWNER</Stamp> {shortAddr(d.owner)}
                        </span>
                        <span className="text-green-dim tabular">{d.amountSol.toFixed(2)} SOL</span>
                        <span className="text-violet text-xs tracking-[0.2em] uppercase">
                          {d.claimableAtMs != null ? "CLAIM PENDING" : "WATCH"} ▶
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
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
              <Stamp>VAULT</Stamp>{" "}
              <span className="text-text">
                {view ? shortAddr(deriveSwitchPda(new PublicKey(view.owner))[0].toBase58()) : "8Hk9...vC3"}
              </span>
            </span>
            <span className="text-muted">·</span>
            <span>
              <Stamp>INTERVAL</Stamp>{" "}
              <span className="text-text">
                {view
                  ? view.intervalSecs < 86400
                    ? fmtSeconds(view.intervalSecs)
                    : fmtInterval(view.intervalDays)
                  : "30 DAYS"}
              </span>
            </span>
          </div>

          <div className="mb-6">
            <StatusBadge
              icon={actionable ? "●" : state === "claimed" ? "✓" : "◇"}
              sub={
                state === "watching"
                  ? "they're still here"
                  : state === "nearing"
                    ? "any moment now"
                    : state === "claimable"
                      ? "start the claim to notify the owner"
                      : state === "challenge"
                        ? "the owner can still veto"
                        : state === "finalizable"
                          ? "no veto — the vault is yours"
                          : "vault closed"
              }
            >
              {state === "watching" && "WATCHING · OWNER IS ACTIVE"}
              {state === "nearing" && "NEARING ZERO · STAY READY"}
              {state === "claimable" && "● CLAIM CAN START"}
              {state === "challenge" && "CLAIM STARTED · CHALLENGE WINDOW"}
              {state === "finalizable" && "● READY TO CLAIM"}
              {state === "claimed" && "✓ CLAIMED"}
            </StatusBadge>
          </div>

          {state !== "claimed" && (
            <>
              <Stamp className="block text-center mb-3">
                {actionable
                  ? ""
                  : state === "watching"
                    ? "IF THEY STAY SILENT FOR"
                    : state === "challenge"
                      ? "OWNER CAN VETO FOR"
                      : "UNTIL CLAIMABLE"}
              </Stamp>
              {actionable && (
                <div
                  className="stamp text-center mb-3"
                  style={{ color: "var(--green)", letterSpacing: "0.4em" }}
                >
                  {state === "claimable" ? "THE OWNER WENT SILENT" : "THE CHALLENGE WINDOW CLOSED"}
                </div>
              )}

              <Countdown
                unlockAtMs={unlockAtMs}
                onExpire={onCountdownExpire}
              />

              {/* Amount block */}
              <div className="text-center mt-10">
                <div className="stamp mb-2.5">
                  {state === "finalizable" ? "THIS VAULT IS YOURS" : "THIS WILL BECOME YOURS"}
                </div>
                <div
                  className={`font-extrabold tabular ${
                    actionable ? "text-green" : "text-green-dim"
                  }`}
                  style={{
                    fontSize: "clamp(3rem, 9vw, 7.5rem)",
                    lineHeight: 0.9,
                    letterSpacing: "-0.03em",
                    textShadow:
                      actionable
                        ? "0 0 28px rgba(0,255,136,.6), 0 0 80px rgba(0,255,136,.3)"
                        : "0 0 24px rgba(0,170,90,.3)",
                    animation:
                      actionable && !reduced
                        ? "amountBreathe 1.6s ease-in-out infinite"
                        : undefined,
                  }}
                >
                  {amountSol.toFixed(2)} SOL
                </div>
              </div>

              {/* CLAIM button */}
              <div className="flex justify-center mt-12">
                <button
                  onClick={executeClaim}
                  disabled={!actionable}
                  className="relative inline-flex flex-col items-center justify-center gap-1.5 px-16 py-7 bg-transparent border-2 font-mono font-extrabold tracking-[0.22em] uppercase text-xl transition-all duration-300 min-w-[360px] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px]"
                  style={{
                    borderColor: "var(--status)",
                    color: "var(--status)",
                    borderWidth: actionable ? 3 : 2,
                    animation:
                      actionable && !reduced
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
                    {state === "claimable"
                      ? "▸ START CLAIM"
                      : state === "finalizable"
                        ? `▸ CLAIM ${amountSol.toFixed(2)} SOL`
                        : "◆ CLAIM"}
                  </span>
                  <span className="text-xs tracking-[0.22em] font-medium text-muted-deep">
                    {actionable
                      ? "press [ space ] or click · 1 tx"
                      : state === "challenge"
                        ? "unlocks when the challenge window closes"
                        : "unlocks at 00:00:00:00"}
                  </span>
                </button>
              </div>

              {(state === "claimable" || state === "challenge") && (
                <div className="max-w-2xl mx-auto bg-amber/[.08] border border-amber/30 border-l-2 border-l-amber px-4 py-3 text-xs text-muted leading-snug flex gap-2.5 mt-6">
                  <span className="text-amber text-[0.95rem]">⚠</span>
                  <span>
                    <strong className="text-amber">two steps, by design.</strong>{" "}
                    starting a claim opens a {CHALLENGE_LABEL} challenge window.
                    if the owner <code className="text-text">check_in</code>s
                    during it, the claim is vetoed. if they stay silent, you
                    finish the claim and the funds are yours.
                    {state === "challenge" && view?.claimableAtMs != null && (
                      <>
                        {" "}window closes ·{" "}
                        <span className="text-text">{fmtUtc(view.claimableAtMs)}</span>
                      </>
                    )}
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
                  {amountSol.toFixed(2)} SOL
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
          fnName={state === "finalizable" ? "claim" : "start_claim"}
          sub={
            state === "finalizable"
              ? "require now >= claim_started_at + challenge → close Switch PDA → lamports to you → emit Claimed"
              : "require now >= last_checkin + interval → open challenge window → emit ClaimStarted"
          }
        />
      )}

      <ErrorToast message={error} onDismiss={() => setError(null)} />

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
