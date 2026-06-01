import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import { Shell } from "../components/Shell";
import { Stamp } from "../components/Stamp";
import { BackLink } from "../components/BackLink";
import { WalletPill } from "../components/WalletPill";
import { Countdown } from "../components/Countdown";
import { StatusBadge } from "../components/StatusBadge";
import { TxOverlay } from "../components/TxOverlay";
import { ErrorToast } from "../components/ErrorToast";
import { useDemoFlag } from "../hooks/useDemoFlag";
import { useProgram } from "../hooks/useProgram";
import { useTx } from "../hooks/useTx";
import { useCountdown } from "../hooks/useCountdown";
import { fmtSeconds, fmtUtc, shortAddr } from "../lib/format";
import {
  cancel as cancelIx,
  checkIn as checkInIx,
  deposit as depositIx,
  explorerAddr,
  fetchSwitch,
  SwitchView,
  toView,
  updateConfig as updateConfigIx,
} from "../lib/anchor";
import { deriveSwitchPda } from "../lib/pda";
import { subscribe } from "../lib/supabase";
import { DepositModal } from "../components/modals/DepositModal";
import { EditConfigModal } from "../components/modals/EditConfigModal";
import { RemindersModal, ReminderSub } from "../components/modals/RemindersModal";
import { CancelModal } from "../components/modals/CancelModal";

type CockpitState = "active" | "warning" | "critical" | "expired";

interface VaultEvent {
  kind: string;
  meta?: string;
  sig: string;
  when: string;
  color: "green" | "amber";
}

/** Derive the escalating status purely from how much time is left. */
function statusFromRemaining(remainingSec: number): CockpitState {
  if (remainingSec <= 0) return "expired";
  if (remainingSec < 3600) return "critical"; // < 1h
  if (remainingSec < 86400) return "warning"; // < 24h
  return "active";
}

/** "just now" / "3h ago" / "18 days ago" relative label. */
function agoLabel(ms: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)} days ago`;
}

export function Cockpit() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const demo = useDemoFlag();
  const { publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const { program, hasSigner } = useProgram();
  const { pending, error, setError, run } = useTx();

  // Fallbacks from the wizard handoff (so the screen still renders pre-fetch
  // or in demo without a real on-chain account).
  const fbBen = params.get("ben") || "9mNxXkZpRq8vJ5Hk2tWxYzAbCdEfGhJkLmNpQrStUwY4";
  const fbAmt = parseFloat(params.get("amt") || "5.0");
  const fbInt = parseInt(params.get("int") || "30");

  // Live on-chain view of the owner's switch (null until fetched / if none).
  const [view, setView] = useState<SwitchView | null>(null);

  const refetch = useCallback(async () => {
    if (!publicKey) return null;
    const s = await fetchSwitch(program, publicKey);
    const v = s ? toView(s) : null;
    setView(v);
    return v;
  }, [program, publicKey]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  // Displayed values prefer real chain data, fall back to the wizard handoff.
  const beneficiary = view?.beneficiary ?? fbBen;
  const amountSol = view?.amountSol ?? fbAmt;
  const intervalDays = view?.intervalDays ?? fbInt;
  const lastCheckinMs = view?.lastCheckinMs ?? Date.now() - 18 * 86400 * 1000;
  const vaultPda = useMemo(
    () => (publicKey ? shortAddr(deriveSwitchPda(publicKey)[0].toBase58()) : "8Hk9...vC3"),
    [publicKey],
  );

  // ?demo=1 lets the presenter override remaining time for rehearsal.
  const [previewRemaining, setPreviewRemaining] = useState<number | null>(null);
  const realUnlockMs = view?.unlockAtMs ?? lastCheckinMs + intervalDays * 86400 * 1000;
  const effectiveUnlock = useMemo(
    () => (previewRemaining == null ? realUnlockMs : Date.now() + previewRemaining * 1000),
    [previewRemaining, realUnlockMs],
  );

  // Status is derived from the live countdown (real or demo-overridden).
  const { remainingSec } = useCountdown(effectiveUnlock, 1000);
  const state = statusFromRemaining(remainingSec);

  // reminders
  const [sub, setSub] = useState<ReminderSub>({
    enabled: params.get("rem") === "1",
    emailEnabled:
      params.get("rem") === "1" && (params.get("ch") || "").includes("email"),
    email:
      params.get("rem") === "1" && (params.get("ch") || "").includes("email")
        ? "owner@example.com"
        : "",
    telegramEnabled:
      params.get("rem") === "1" && (params.get("ch") || "").includes("tg"),
    telegram: "",
    leadSeconds: parseInt(params.get("lead") || "21600"),
    frequencySeconds: parseInt(params.get("freq") || "900"),
  });

  // activity feed
  const [events, setEvents] = useState<VaultEvent[]>([
    ...(sub.enabled
      ? [
          {
            kind: "Subscribed (off-chain)",
            meta: `lead ${fmtSeconds(sub.leadSeconds)} · repeat ${fmtSeconds(sub.frequencySeconds)}`,
            sig: "supabase",
            when: "just now",
            color: "amber" as const,
          },
        ]
      : []),
    {
      kind: "SwitchInitialized",
      meta: `${amountSol.toFixed(2)} SOL · ${intervalDays}d interval`,
      sig: "7mNq...rT5",
      when: "just now",
      color: "green",
    },
    { kind: "CheckedIn", sig: "4Hk9...8nQ", when: "May 11, 14:23", color: "green" },
    { kind: "CheckedIn", sig: "9aB2...Lm3", when: "Apr 11, 09:01", color: "green" },
  ]);
  const pushEvent = (ev: VaultEvent) => setEvents((prev) => [ev, ...prev]);

  // modals
  const [openModal, setOpenModal] = useState<
    null | "deposit" | "config" | "reminders" | "cancel"
  >(null);

  // Prompt connect if there's no signer; otherwise hand back the owner pubkey.
  function requireSigner(): PublicKey | null {
    if (!hasSigner || !publicKey) {
      setVisible(true);
      return null;
    }
    return publicKey;
  }

  // Actions — each sends a real transaction, then refetches the switch.
  function doCheckIn() {
    const owner = requireSigner();
    if (!owner) return;
    run(
      { fnName: "check_in", sub: "last_checkin reset to Clock::now()" },
      () => checkInIx(program, owner),
      async (sig) => {
        setPreviewRemaining(null);
        await refetch();
        pushEvent({ kind: "CheckedIn", meta: "last_checkin reset", sig: shortAddr(sig), when: "just now", color: "green" });
      },
    );
  }

  function doDeposit(addSol: number) {
    const owner = requireSigner();
    if (!owner) return;
    setOpenModal(null);
    run(
      { fnName: "deposit", sub: `+${addSol.toFixed(2)} SOL` },
      () => depositIx(program, owner, addSol),
      async (sig) => {
        const v = await refetch();
        const total = v?.amountSol ?? amountSol + addSol;
        pushEvent({ kind: "Deposited", meta: `+${addSol.toFixed(2)} SOL · total ${total.toFixed(2)} SOL`, sig: shortAddr(sig), when: "just now", color: "green" });
      },
    );
  }

  function doUpdateConfig(newBeneficiary?: string, newIntervalDays?: number) {
    if (!newBeneficiary && !newIntervalDays) {
      setError("Nothing to change — enter a new beneficiary, interval, or both.");
      return;
    }
    const owner = requireSigner();
    if (!owner) return;
    let benPk: PublicKey | null = null;
    if (newBeneficiary) {
      try {
        benPk = new PublicKey(newBeneficiary);
      } catch {
        setError("New beneficiary is not a valid Solana address");
        return;
      }
    }
    setOpenModal(null);
    const parts: string[] = [];
    if (newBeneficiary) parts.push(`ben → ${shortAddr(newBeneficiary)}`);
    if (newIntervalDays) parts.push(`interval → ${newIntervalDays}d`);
    run(
      { fnName: "update_config", sub: parts.join(" · ") },
      () => updateConfigIx(program, owner, benPk, newIntervalDays ? newIntervalDays * 86400 : null),
      async (sig) => {
        await refetch();
        pushEvent({ kind: "ConfigUpdated", meta: parts.join(" · "), sig: shortAddr(sig), when: "just now", color: "green" });
      },
    );
  }

  function doCancel() {
    const owner = requireSigner();
    if (!owner) return;
    setOpenModal(null);
    run(
      { fnName: "cancel", sub: `${amountSol.toFixed(2)} SOL returned · vault closed` },
      () => cancelIx(program, owner),
      (sig) => {
        pushEvent({ kind: "Cancelled", sig: shortAddr(sig), when: "just now", color: "green" });
        setTimeout(() => navigate("/identify"), 1200);
      },
    );
  }

  function saveReminders(next: ReminderSub) {
    const owner = requireSigner();
    if (!owner) return;
    setOpenModal(null);
    const [switchPda] = deriveSwitchPda(owner);
    const chans = [next.emailEnabled && "email", next.telegramEnabled && "telegram"]
      .filter(Boolean)
      .join(" + ");
    run(
      {
        fnName: "subscribe (off-chain)",
        variant: "offchain",
        sub: `${chans} · lead ${fmtSeconds(next.leadSeconds)} · repeat ${fmtSeconds(next.frequencySeconds)}`,
      },
      () =>
        subscribe({
          switch_pda: switchPda.toBase58(),
          owner_pubkey: owner.toBase58(),
          email: next.emailEnabled ? next.email || undefined : undefined,
          telegram_chat_id: next.telegramEnabled ? next.telegram || undefined : undefined,
          lead_seconds: next.leadSeconds,
          frequency_seconds: next.frequencySeconds,
          enabled: next.enabled,
        }),
      (res) => {
        if (!res.ok) {
          setError(`Subscribe failed: ${res.error}`);
          return;
        }
        setSub(next);
        pushEvent({ kind: "Subscribed (off-chain)", meta: `${chans} · lead ${fmtSeconds(next.leadSeconds)}`, sig: "supabase", when: "just now", color: "amber" });
      },
    );
  }

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.code === "Space") {
        if (openModal) return;
        e.preventDefault();
        doCheckIn();
      } else if (demo && e.key === "1") setPreviewState("active");
      else if (demo && e.key === "2") setPreviewState("warning");
      else if (demo && e.key === "3") setPreviewState("critical");
      else if (demo && e.key === "4") setPreviewState("expired");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openModal, demo]);

  // Demo override — sets a synthetic remaining time; `state` re-derives from it.
  function setPreviewState(s: CockpitState) {
    switch (s) {
      case "active":
        setPreviewRemaining(11 * 86400 + 23 * 3600 + 47 * 60 + 12);
        break;
      case "warning":
        setPreviewRemaining(12 * 3600 + 14 * 60 + 38);
        break;
      case "critical":
        setPreviewRemaining(47);
        break;
      case "expired":
        setPreviewRemaining(0);
        break;
    }
  }

  const statusInfo = useMemo(() => {
    switch (state) {
      case "active":
        return { text: "ARMED · LOCKED", sub: "vault is watching" };
      case "warning":
        return { text: "ARMED · 24H WINDOW", sub: "check in soon" };
      case "critical":
        return { text: "CRITICAL · CHECK IN NOW", sub: "danger zone" };
      case "expired":
        return { text: "EXPIRED · BENEFICIARY CAN CLAIM", sub: "race in progress" };
    }
  }, [state]);

  return (
    <Shell state={state} bodyClass={demo ? "demo-mode" : undefined}>
      <header className="px-10 py-6 flex justify-between items-center flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <BackLink to="/identify" label="EXIT" />
          <WalletPill role="OWNER" />
          <div
            className={`inline-flex items-center gap-2 px-3 py-2 border bg-panel text-[0.65rem] tracking-[0.18em] uppercase ${
              sub.enabled ? "text-green border-green/35" : "text-muted border-border"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                sub.enabled ? "bg-green shadow-[0_0_8px_var(--green)]" : "bg-muted"
              }`}
            />
            REMINDERS · {sub.enabled ? `ON · ${fmtSeconds(sub.leadSeconds)} LEAD` : "OFF"}
          </div>
        </div>

        {/* Demo-only state toggle */}
        {demo && (
          <div
            role="group"
            aria-label="Preview countdown state"
            className="flex gap-2 p-2 bg-panel border border-border"
          >
            {(["active", "warning", "critical", "expired"] as CockpitState[]).map((s) => (
              <button
                key={s}
                onClick={() => setPreviewState(s)}
                className={`font-mono text-[0.65rem] tracking-[0.18em] uppercase px-2.5 py-1.5 border transition-all ${
                  state === s
                    ? "bg-panel-2 border-[var(--status)] text-[var(--status)]"
                    : "border-transparent text-muted hover:text-text"
                }`}
              >
                {s === "warning" ? "WARN <24h" : s === "critical" ? "CRIT <1m" : s.toUpperCase()}
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-6 py-2">
        {/* Vault info ribbon */}
        <div className="flex items-center justify-center gap-6 px-6 py-3 bg-panel border border-border text-xs tracking-wider flex-wrap mb-10">
          <span>
            <Stamp>VAULT</Stamp> <span className="text-text">{vaultPda}</span>
          </span>
          <span className="text-muted">·</span>
          <span>
            <Stamp>LOCKED</Stamp>{" "}
            <span className="font-bold glow-status" style={{ color: "var(--status)" }}>
              {amountSol.toFixed(2)} SOL
            </span>
          </span>
          <span style={{ color: "var(--status)" }}>▶</span>
          <span>
            <Stamp>→ HEIR</Stamp>{" "}
            <span className="text-text">{shortAddr(beneficiary)}</span>
          </span>
          <span className="text-muted">·</span>
          <span>
            <Stamp>INTERVAL</Stamp> <span className="text-text">{intervalDays} DAYS</span>
          </span>
        </div>

        {/* Expired banner */}
        {state === "expired" && (
          <div className="bg-red/[.12] border border-red px-5 py-4.5 mb-6">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-red text-lg">⚠</span>
              <Stamp tone="red">BENEFICIARY CAN CLAIM NOW</Stamp>
            </div>
            <p className="text-sm text-text mt-2 leading-relaxed">
              your interval elapsed. the wallet{" "}
              <span className="text-red font-semibold">{shortAddr(beneficiary)}</span>{" "}
              can now broadcast a claim() tx and take the funds. you can still
              check in to reset the timer —{" "}
              <span className="font-semibold">but you're in a race.</span>
            </p>
          </div>
        )}

        <div className="mb-6">
          <StatusBadge
            icon={state === "expired" ? "⚠" : "◇"}
            sub={statusInfo.sub}
          >
            {statusInfo.text}
          </StatusBadge>
        </div>

        <Stamp className="block text-center mb-3">
          {state === "expired" ? "OVERDUE BY" : "UNLOCKS IN"}
        </Stamp>

        <Countdown unlockAtMs={effectiveUnlock} />

        <div className="text-center mt-6 text-sm text-muted">
          next deadline ·{" "}
          <span className="font-semibold" style={{ color: "var(--status)" }}>
            {fmtUtc(effectiveUnlock)}
          </span>
        </div>

        {/* Hero CHECK_IN */}
        <div className="flex justify-center mt-12">
          <button
            onClick={doCheckIn}
            className="relative inline-flex flex-col items-center justify-center gap-1.5 px-16 py-8 bg-transparent border-2 border-green text-green font-mono font-extrabold tracking-[0.22em] uppercase cursor-pointer text-xl transition-all duration-300 min-w-[380px] hover:bg-green hover:text-black hover:shadow-[0_0_90px_rgba(0,255,136,.6),inset_0_0_32px_rgba(255,255,255,.18)] hover:tracking-[0.26em] min-h-[44px]"
            style={{
              boxShadow:
                "0 0 30px rgba(0,255,136,.25), inset 0 0 24px rgba(0,255,136,.04)",
              animation:
                state === "active" ? "ctaBreath 3.6s ease-in-out infinite" : "none",
            }}
          >
            <span className="absolute top-[-10px] left-[-10px] w-3.5 h-3.5 border-t-2 border-l-2 border-green" />
            <span className="absolute bottom-[-10px] right-[-10px] w-3.5 h-3.5 border-b-2 border-r-2 border-green" />
            <span>{state === "expired" ? "▶ RACE TO CHECK IN" : "◆ CHECK IN"}</span>
            <span className="text-xs tracking-[0.25em] font-medium text-muted">
              {state === "expired"
                ? "beneficiary can claim now — be first"
                : "reset the timer · 1 tx"}
            </span>
          </button>
        </div>

        <div className="text-center mt-6 text-sm text-muted">
          last check-in ·{" "}
          <span className="font-semibold text-text">{agoLabel(lastCheckinMs)}</span> ·{" "}
          {fmtUtc(lastCheckinMs)}
        </div>

        {/* Secondary actions */}
        <div
          role="group"
          aria-label="Vault actions"
          className="flex gap-3 justify-center flex-wrap mt-8"
        >
          <SecBtn icon="＋" label="DEPOSIT" onClick={() => setOpenModal("deposit")} />
          <SecBtn icon="⚙" label="EDIT CONFIG" onClick={() => setOpenModal("config")} />
          <SecBtn
            icon="◔"
            label="REMINDERS"
            onClick={() => setOpenModal("reminders")}
          />
        </div>

        {/* Footer */}
        <div className="mt-16 pt-5 border-t border-border flex justify-between items-center flex-wrap gap-4">
          <button
            onClick={() => setOpenModal("cancel")}
            className="text-[0.7rem] tracking-[0.25em] uppercase text-muted cursor-pointer px-3 py-2 border border-transparent transition-colors hover:text-red hover:border-red"
          >
            ◀ CANCEL VAULT · returns {amountSol.toFixed(2)} SOL to your wallet
          </button>
          <div className="flex gap-2">
            <button
              onClick={() =>
                publicKey &&
                window.open(explorerAddr(deriveSwitchPda(publicKey)[0].toBase58()), "_blank")
              }
              className="text-[0.7rem] tracking-[0.25em] uppercase text-muted cursor-pointer px-3 py-2 border border-transparent transition-colors hover:text-text hover:border-border"
            >
              VIEW ON SOLANA EXPLORER ▸
            </button>
            <button
              onClick={() =>
                alert(
                  "[mockup] event log:\n\n" +
                    events
                      .map(
                        (e) =>
                          `${e.kind.padEnd(22)} ${
                            e.meta ? "· " + e.meta + " " : ""
                          }· ${e.sig}  (${e.when})`,
                      )
                      .join("\n"),
                )
              }
              className="text-[0.7rem] tracking-[0.25em] uppercase text-muted cursor-pointer px-3 py-2 border border-transparent transition-colors hover:text-text hover:border-border"
            >
              ▤ EVENT LOG ({events.length})
            </button>
          </div>
        </div>
      </main>

      {/* Modals */}
      <DepositModal
        open={openModal === "deposit"}
        onClose={() => setOpenModal(null)}
        currentLocked={amountSol}
        walletBalance={12.4}
        onDeposit={doDeposit}
      />
      <EditConfigModal
        open={openModal === "config"}
        onClose={() => setOpenModal(null)}
        currentBeneficiary={beneficiary}
        currentIntervalDays={intervalDays}
        lastCheckinMs={lastCheckinMs}
        nowMs={Date.now()}
        onSave={doUpdateConfig}
      />
      <RemindersModal
        open={openModal === "reminders"}
        onClose={() => setOpenModal(null)}
        subscription={sub}
        onSave={saveReminders}
        onDisable={() => {
          setSub({ ...sub, enabled: false, emailEnabled: false, telegramEnabled: false });
          setOpenModal(null);
        }}
      />
      <CancelModal
        open={openModal === "cancel"}
        onClose={() => setOpenModal(null)}
        amountSol={amountSol}
        onConfirm={doCancel}
      />

      {pending && (
        <TxOverlay fnName={pending.fnName} sub={pending.sub} variant={pending.variant} />
      )}
      <ErrorToast message={error} onDismiss={() => setError(null)} />


      <style>{`
        @keyframes ctaBreath {
          0%, 100% {
            box-shadow: 0 0 30px rgba(0,255,136,.25), inset 0 0 24px rgba(0,255,136,.04);
          }
          50% {
            box-shadow: 0 0 60px rgba(0,255,136,.45), inset 0 0 40px rgba(0,255,136,.08);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          button[style*="ctaBreath"] { animation: none !important; }
        }
      `}</style>
    </Shell>
  );
}

function SecBtn({
  icon,
  label,
  onClick,
}: {
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="inline-flex items-center gap-2.5 font-mono font-semibold tracking-[0.18em] uppercase text-xs px-5 py-3 border border-border bg-panel text-text cursor-pointer transition-all duration-200 hover:border-green hover:text-green hover:shadow-[0_0_24px_rgba(0,255,136,.18)] min-h-[44px]"
    >
      <span aria-hidden className="text-base text-muted">
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}
