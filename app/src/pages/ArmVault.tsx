import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { Shell } from "../components/Shell";
import { Stamp } from "../components/Stamp";
import { BackLink } from "../components/BackLink";
import { WalletPill } from "../components/WalletPill";
import { Field, FieldHint, FieldLabel } from "../components/Field";
import { PresetGroup } from "../components/PresetGroup";
import { Button } from "../components/Button";
import { TxOverlay } from "../components/TxOverlay";
import { useFlag } from "../hooks/useDemoFlag";
import { fmtInterval, fmtSeconds, looksLikeSolanaAddress, shortAddr } from "../lib/format";

type Step = 1 | 2 | 3 | 4 | 5;
type TxState = null | "arming" | "subscribing";

interface ReminderState {
  emailEnabled: boolean;
  email: string;
  telegramEnabled: boolean;
  telegram: string;
  leadSeconds: number;
  frequencySeconds: number;
}

const STEP_LABELS: Record<Step, string> = {
  1: "STEP 01 OF 05 · BENEFICIARY",
  2: "STEP 02 OF 05 · INTERVAL",
  3: "STEP 03 OF 05 · AMOUNT",
  4: "STEP 04 OF 05 · OATH · ON-CHAIN",
  5: "STEP 05 OF 05 · REMINDERS · OPTIONAL",
};

const TICKS: { n: Step; label: string }[] = [
  { n: 1, label: "01 BENEFICIARY" },
  { n: 2, label: "02 INTERVAL" },
  { n: 3, label: "03 AMOUNT" },
  { n: 4, label: "04 OATH" },
  { n: 5, label: "05 REMINDERS" },
];

export function ArmVault() {
  const navigate = useNavigate();
  const { connected } = useWallet();
  const existingFlag = useFlag("existing");

  // ?existing=1 simulates a switch already deployed for this owner
  const [showExisting, setShowExisting] = useState(existingFlag);

  const [step, setStep] = useState<Step>(1);
  const [beneficiary, setBeneficiary] = useState(
    "9mNxXkZpRq8vJ5Hk2tWxYzAbCdEfGhJkLmNpQrStUwY4",
  );
  const [intervalDays, setIntervalDays] = useState(30);
  const [amountSol, setAmountSol] = useState(5.0);
  const [reminder, setReminder] = useState<ReminderState>({
    emailEnabled: true,
    email: "",
    telegramEnabled: false,
    telegram: "",
    leadSeconds: 21600,
    frequencySeconds: 900,
  });
  const [tx, setTx] = useState<TxState>(null);

  const beneficiaryValid = useMemo(
    () => looksLikeSolanaAddress(beneficiary),
    [beneficiary],
  );

  // Step 4 arm → step 5
  function armVault() {
    // TODO: real Anchor call:
    //   await program.methods.initialize(new PublicKey(beneficiary), new BN(intervalDays * 86400), new BN(amountSol * LAMPORTS_PER_SOL))
    //     .accounts({ switch: switchPda, owner: wallet.publicKey, systemProgram: SystemProgram.programId })
    //     .rpc()
    setTx("arming");
    setTimeout(() => {
      setTx(null);
      setStep(5);
    }, 2000);
  }

  function navigateToCockpit(withReminders: boolean) {
    const qs = new URLSearchParams({
      ben: beneficiary,
      int: String(intervalDays),
      amt: String(amountSol),
    });
    if (withReminders) {
      qs.set("rem", "1");
      qs.set("lead", String(reminder.leadSeconds));
      qs.set("freq", String(reminder.frequencySeconds));
      qs.set(
        "ch",
        [
          reminder.emailEnabled ? "email" : null,
          reminder.telegramEnabled ? "tg" : null,
        ]
          .filter(Boolean)
          .join(","),
      );
    }
    navigate(`/cockpit?${qs.toString()}`);
  }

  function subscribeAndContinue() {
    // TODO: real fetch:
    //   await subscribe({ switch_pda, owner_pubkey, email: reminder.email, ... })
    setTx("subscribing");
    setTimeout(() => {
      setTx(null);
      navigateToCockpit(true);
    }, 1400);
  }

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (step > 1) setStep((step - 1) as Step);
        else navigate("/identify");
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [step, navigate]);

  return (
    <Shell>
      <header className="px-10 py-6 flex justify-between items-center">
        <BackLink to="/identify" label="BACK · ROLE SELECT" />
        <WalletPill role="OWNER" />
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {showExisting && (
          <ExistingBanner onDismiss={() => setShowExisting(false)} />
        )}

        {/* Progress bar */}
        <div className="mb-3 flex items-center justify-between">
          <Stamp>{STEP_LABELS[step]}</Stamp>
          <Stamp>{step * 20}%</Stamp>
        </div>
        <div className="h-[3px] bg-panel border border-border relative overflow-hidden mb-2">
          <div
            className="h-full bg-green transition-[width] duration-500"
            style={{
              width: `${step * 20}%`,
              boxShadow:
                "0 0 12px var(--green), 0 0 24px rgba(0,255,136,.5)",
            }}
          />
        </div>
        <div className="flex justify-between mt-2 mb-8 font-mono text-[0.65rem] tracking-[0.18em] uppercase">
          {TICKS.map((t) => (
            <span
              key={t.n}
              className={`transition-colors duration-300 ${
                t.n === step
                  ? "text-green [text-shadow:0_0_8px_var(--green)]"
                  : t.n < step
                    ? "text-green-dim"
                    : "text-muted"
              }`}
            >
              {t.label}
            </span>
          ))}
        </div>

        {/* Summary chips */}
        <div className="flex gap-2 flex-wrap mb-6 min-h-[32px]">
          {step > 1 && (
            <Chip label="BENEFICIARY" value={shortAddr(beneficiary)} />
          )}
          {step > 2 && (
            <Chip label="INTERVAL" value={fmtInterval(intervalDays)} />
          )}
          {step > 3 && (
            <Chip label="AMOUNT" value={`${amountSol.toFixed(2)} SOL`} />
          )}
        </div>

        {/* Step bodies */}
        {step === 1 && (
          <StepBeneficiary
            beneficiary={beneficiary}
            setBeneficiary={setBeneficiary}
            valid={beneficiaryValid}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <StepInterval
            days={intervalDays}
            setDays={setIntervalDays}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}
        {step === 3 && (
          <StepAmount
            amount={amountSol}
            setAmount={setAmountSol}
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
          />
        )}
        {step === 4 && (
          <StepOath
            beneficiary={beneficiary}
            intervalDays={intervalDays}
            amountSol={amountSol}
            onBack={() => setStep(3)}
            onArm={armVault}
            connected={connected}
          />
        )}
        {step === 5 && (
          <StepReminders
            reminder={reminder}
            setReminder={setReminder}
            onSkip={() => navigateToCockpit(false)}
            onSubscribe={subscribeAndContinue}
          />
        )}
      </main>

      {tx === "arming" && (
        <TxOverlay
          fnName="initialize"
          sub="wallet popup → confirm → tx broadcasts → vault PDA created → SwitchInitialized event emitted"
        />
      )}
      {tx === "subscribing" && (
        <TxOverlay
          fnName="subscribe (off-chain)"
          variant="offchain"
          sub="verify switch.owner == owner_pubkey on-chain → upsert into reminder_subscriptions"
        />
      )}
    </Shell>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-panel border border-border text-xs font-mono">
      <span className="stamp">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function ExistingBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      role="alert"
      className="relative bg-amber/[.06] border border-amber/40 p-7 mb-8"
    >
      <span className="absolute top-[-1px] left-[-1px] w-3 h-3 border-t-2 border-l-2 border-amber" />
      <span className="absolute bottom-[-1px] right-[-1px] w-3 h-3 border-b-2 border-r-2 border-amber" />
      <div className="stamp text-amber font-bold mb-2.5 flex items-center gap-2">
        ⚠ <span>EXISTING VAULT DETECTED · ON-CHAIN</span>
      </div>
      <h2 className="font-mono font-extrabold text-xl text-text mb-2.5">
        your wallet already has a switch deployed.
      </h2>
      <p className="text-muted text-sm leading-relaxed mb-5">
        the program will reject a second <code>initialize()</code> — switch PDAs
        are seeded by <code>(b"switch", owner.key())</code> and the account
        already exists. continue to manage your existing vault.
      </p>
      <div className="flex gap-3 flex-wrap">
        <Link to="/cockpit" className="inline-block">
          <Button variant="primary">CONTINUE ▸ TO COCKPIT</Button>
        </Link>
        <Button onClick={onDismiss}>DISMISS · show wizard anyway</Button>
      </div>
    </div>
  );
}

function StepBeneficiary({
  beneficiary,
  setBeneficiary,
  valid,
  onNext,
}: {
  beneficiary: string;
  setBeneficiary: (s: string) => void;
  valid: boolean;
  onNext: () => void;
}) {
  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2
          className="font-extrabold text-text leading-tight"
          style={{ fontSize: "clamp(1.6rem, 3.6vw, 2.8rem)", letterSpacing: "-0.025em" }}
        >
          <span className="text-green">&gt;</span> WHO SHOULD INHERIT?
          <span className="text-green animate-blink">_</span>
        </h2>
        <p className="text-muted text-base mt-2.5">
          paste the Solana wallet address that should receive these funds if you go silent.
        </p>
      </div>

      <div>
        <Field
          autoFocus
          size="big"
          value={beneficiary}
          onChange={(e) => setBeneficiary(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && valid) onNext();
          }}
          invalid={beneficiary.length > 0 && !valid}
          placeholder="9mNxXkZpRq...wYz4"
        />
        <div className="flex justify-between items-center mt-2">
          <FieldHint variant={valid ? "ok" : beneficiary.length === 0 ? "info" : "bad"}>
            {valid
              ? "✓ valid Solana address format"
              : beneficiary.length === 0
                ? "expecting a 32–44 character base58 pubkey"
                : `${beneficiary.length} chars — ${beneficiary.length < 32 ? "too short" : beneficiary.length > 44 ? "too long" : "invalid characters"}`}
          </FieldHint>
          <FieldHint>{beneficiary.length} / 44</FieldHint>
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <Link to="/identify">
          <Button>◀ BACK</Button>
        </Link>
        <Button variant="primary" disabled={!valid} onClick={onNext}>
          NEXT ▶▶
        </Button>
      </div>
    </section>
  );
}

function StepInterval({
  days,
  setDays,
  onBack,
  onNext,
}: {
  days: number;
  setDays: (d: number) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2
          className="font-extrabold text-text leading-tight"
          style={{ fontSize: "clamp(1.6rem, 3.6vw, 2.8rem)", letterSpacing: "-0.025em" }}
        >
          <span className="text-green">&gt;</span> HOW LONG BEFORE WE ASSUME YOU'RE GONE?
        </h2>
        <p className="text-muted text-base mt-2.5">
          choose a check-in interval. you must check in before this elapses — otherwise the funds release.
        </p>
      </div>

      <div>
        <Field
          size="mega"
          type="number"
          min={1}
          value={days}
          onKeyDown={(e) => {
            if (e.key === "Enter") onNext();
          }}
          onChange={(e) => setDays(parseInt(e.target.value) || 0)}
        />
        <div className="text-muted text-sm tracking-widest uppercase text-center mt-[-0.5rem]">
          DAYS
        </div>
        <div className="flex justify-center mt-4">
          <PresetGroup
            ariaLabel="interval presets"
            value={days}
            onChange={setDays}
            options={[
              { value: 1, label: "1 DAY" },
              { value: 7, label: "7 DAYS" },
              { value: 30, label: "30 DAYS" },
              { value: 90, label: "90 DAYS" },
              { value: 365, label: "1 YEAR" },
            ]}
          />
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <Button onClick={onBack}>◀ BACK</Button>
        <Button variant="primary" onClick={onNext}>
          NEXT ▶▶
        </Button>
      </div>
    </section>
  );
}

function StepAmount({
  amount,
  setAmount,
  onBack,
  onNext,
}: {
  amount: number;
  setAmount: (n: number) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2
          className="font-extrabold text-text leading-tight"
          style={{ fontSize: "clamp(1.6rem, 3.6vw, 2.8rem)", letterSpacing: "-0.025em" }}
        >
          <span className="text-green">&gt;</span> HOW MUCH WILL YOU LOCK?
        </h2>
        <p className="text-muted text-base mt-2.5">
          this SOL gets deposited into a vault PDA. it stays there until you cancel or the beneficiary claims.
        </p>
      </div>

      <div>
        <Field
          size="mega"
          type="number"
          step={0.01}
          min={0.01}
          value={amount}
          onKeyDown={(e) => {
            if (e.key === "Enter") onNext();
          }}
          onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
        />
        <div className="text-muted text-sm tracking-widest uppercase text-center mt-[-0.5rem]">
          SOL
        </div>
        <div className="text-center mt-4 text-xs text-muted">
          wallet balance: <span className="text-green glow-green">12.40 SOL</span>
          <button
            type="button"
            onClick={() => setAmount(12.39)}
            className="ml-2 text-amber underline underline-offset-2 hover:text-amber-dim"
          >
            [ MAX ]
          </button>
        </div>
        <div className="flex justify-center mt-4">
          <PresetGroup
            ariaLabel="amount presets"
            value={amount}
            onChange={setAmount}
            options={[
              { value: 0.1, label: "0.1" },
              { value: 0.5, label: "0.5" },
              { value: 1, label: "1.0" },
              { value: 5, label: "5.0" },
            ]}
          />
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <Button onClick={onBack}>◀ BACK</Button>
        <Button variant="primary" onClick={onNext}>
          NEXT ▶▶
        </Button>
      </div>
    </section>
  );
}

function StepOath({
  beneficiary,
  intervalDays,
  amountSol,
  onBack,
  onArm,
  connected,
}: {
  beneficiary: string;
  intervalDays: number;
  amountSol: number;
  onBack: () => void;
  onArm: () => void;
  connected: boolean;
}) {
  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2
          className="font-extrabold leading-tight text-red glow-red"
          style={{ fontSize: "clamp(1.6rem, 3.6vw, 2.8rem)", letterSpacing: "-0.025em" }}
        >
          <span className="text-red">!</span> READ THIS CAREFULLY.
        </h2>
        <p className="text-muted text-base mt-2.5">
          this is your last chance to back out without spending gas.
        </p>
      </div>

      <div className="relative bg-panel border border-border p-10">
        <span className="absolute top-[-1px] left-[-1px] w-4.5 h-4.5 border-t-2 border-l-2 border-red" style={{ width: 18, height: 18 }} />
        <span className="absolute top-[-1px] right-[-1px] w-4.5 h-4.5 border-t-2 border-r-2 border-red" style={{ width: 18, height: 18 }} />
        <span className="absolute bottom-[-1px] left-[-1px] w-4.5 h-4.5 border-b-2 border-l-2 border-red" style={{ width: 18, height: 18 }} />
        <span className="absolute bottom-[-1px] right-[-1px] w-4.5 h-4.5 border-b-2 border-r-2 border-red" style={{ width: 18, height: 18 }} />

        <div className="text-base text-muted leading-loose">YOU ARE ABOUT TO LOCK</div>
        <div className="text-5xl font-extrabold text-amber glow-amber my-1">
          {amountSol.toFixed(2)} SOL
        </div>

        <div className="text-base text-muted leading-loose mt-6">
          IF YOU DO NOT CHECK IN AT LEAST ONCE EVERY
        </div>
        <div className="text-5xl font-extrabold text-amber glow-amber my-1">
          {fmtInterval(intervalDays)}
        </div>

        <div className="text-base text-muted leading-loose mt-6">THE WALLET</div>
        <div className="font-extrabold text-text break-all" style={{ fontSize: "clamp(1rem, 2.2vw, 1.6rem)" }}>
          {beneficiary}
        </div>
        <div className="text-base text-muted leading-loose">WILL TAKE THE FUNDS. PERMANENTLY.</div>

        <hr className="my-7 border-t border-dashed border-border" />

        <div className="text-base text-muted leading-loose">
          this is enforced <span className="text-text font-bold">on-chain</span> by program{" "}
          <span className="text-amber font-bold">6gbT...fFu</span>.
        </div>
        <div className="text-base text-muted leading-loose">
          <span className="text-red font-extrabold">NO ONE</span> can undo this{" "}
          <span className="text-text font-bold">except you</span> (via cancel).
        </div>
        <div className="text-base text-muted leading-loose mt-1">
          <span className="text-red font-extrabold">NO CUSTODIAN.</span>{" "}
          <span className="text-red font-extrabold">NO ADMIN KEY.</span>{" "}
          <span className="text-red font-extrabold">NO BACKDOOR.</span>
        </div>
      </div>

      {!connected && (
        <div className="text-amber text-sm flex items-center gap-2">
          ⚠ wallet not connected — click ARM to open the wallet picker
        </div>
      )}

      <div className="flex justify-between gap-3 mt-6">
        <Button onClick={onBack}>◀ EDIT</Button>
        <Button variant="danger" onClick={onArm}>
          I UNDERSTAND ▸ ARM IT
        </Button>
      </div>
    </section>
  );
}

function StepReminders({
  reminder,
  setReminder,
  onSkip,
  onSubscribe,
}: {
  reminder: ReminderState;
  setReminder: (r: ReminderState) => void;
  onSkip: () => void;
  onSubscribe: () => void;
}) {
  return (
    <section className="flex flex-col gap-6">
      {/* vault-armed success banner */}
      <div className="bg-green/[.06] border border-green/35 px-5 py-3.5 flex items-center gap-3.5">
        <span className="text-green text-lg [text-shadow:0_0_10px_rgba(0,255,136,.6)]">
          ✓
        </span>
        <div>
          <Stamp tone="green">VAULT ARMED · TX CONFIRMED</Stamp>
          <div className="text-xs text-muted mt-1">
            switch PDA{" "}
            <span className="text-text">8Hk9...vC3</span> · funds locked ·
            countdown started
          </div>
        </div>
        <span className="stamp ml-auto">tx 7mNq...rT5</span>
      </div>

      <div>
        <h2
          className="font-extrabold text-text leading-tight"
          style={{ fontSize: "clamp(1.6rem, 3.6vw, 2.8rem)", letterSpacing: "-0.025em" }}
        >
          <span className="text-green">&gt;</span> DON'T MISS YOUR CHECK-IN.
          <span className="text-green animate-blink">_</span>
        </h2>
        <p className="text-muted text-base mt-2.5 leading-relaxed">
          optional · off-chain · you can edit or disable any time.
          <br />
          we email or Telegram you before your interval elapses so the vault doesn't release on accident.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <ChannelCard
          on={reminder.emailEnabled}
          icon="✉"
          label="EMAIL"
          meta="delivered via Resend"
          onToggle={() =>
            setReminder({ ...reminder, emailEnabled: !reminder.emailEnabled })
          }
          input={
            <Field
              type="email"
              placeholder="owner@example.com"
              value={reminder.email}
              onChange={(e) => setReminder({ ...reminder, email: e.target.value })}
            />
          }
        />
        <ChannelCard
          on={reminder.telegramEnabled}
          icon="◉"
          label="TELEGRAM"
          meta="via Telegram Bot API"
          onToggle={() =>
            setReminder({
              ...reminder,
              telegramEnabled: !reminder.telegramEnabled,
            })
          }
          input={
            <Field
              placeholder="chat id (DM @deadman_switch_bot first)"
              value={reminder.telegram}
              onChange={(e) => setReminder({ ...reminder, telegram: e.target.value })}
            />
          }
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6 mt-2">
        <div>
          <FieldLabel>START WARNING ME</FieldLabel>
          <p className="text-xs text-muted mb-3">
            how far ahead of unlock to begin reminding
          </p>
          <PresetGroup
            ariaLabel="lead time"
            value={reminder.leadSeconds}
            onChange={(v) => setReminder({ ...reminder, leadSeconds: v })}
            options={[
              { value: 3600, label: "1H" },
              { value: 21600, label: "6H" },
              { value: 86400, label: "24H" },
              { value: 259200, label: "3D" },
            ]}
          />
        </div>
        <div>
          <FieldLabel>REPEAT EVERY</FieldLabel>
          <p className="text-xs text-muted mb-3">
            cadence inside the warning window
          </p>
          <PresetGroup
            ariaLabel="repeat frequency"
            value={reminder.frequencySeconds}
            onChange={(v) => setReminder({ ...reminder, frequencySeconds: v })}
            options={[
              { value: 900, label: "15M" },
              { value: 3600, label: "1H" },
              { value: 21600, label: "6H" },
              { value: 0, label: "OFF" },
            ]}
          />
        </div>
      </div>

      <div className="bg-panel-2 border border-border border-l-2 border-l-amber px-4 py-3.5 text-xs leading-relaxed text-muted flex gap-3">
        <span className="text-amber">ⓘ</span>
        <span>
          contact info lives <strong className="text-text">off-chain</strong> in
          Supabase (RLS-locked, service-role only).{" "}
          <strong className="text-text">not part of enforcement</strong> — if the
          notifier goes down, your funds are exactly as safe. the on-chain{" "}
          <code className="text-green">claim</code> still requires the time gate.
        </span>
      </div>

      <div className="flex justify-between gap-3 mt-6">
        <Button onClick={onSkip}>SKIP ▸ TO COCKPIT</Button>
        <Button variant="primary" onClick={onSubscribe}>
          SUBSCRIBE ▶▶
        </Button>
      </div>
    </section>
  );
}

function ChannelCard({
  on,
  icon,
  label,
  meta,
  onToggle,
  input,
}: {
  on: boolean;
  icon: string;
  label: string;
  meta: string;
  onToggle: () => void;
  input: React.ReactNode;
}) {
  return (
    <div
      className={`border bg-panel p-5 transition-all duration-300 ${
        on
          ? "border-green/40 bg-[#0a100c]"
          : "border-border"
      }`}
    >
      <div
        className={`flex items-center gap-3 mb-3 transition-opacity duration-200 ${
          on ? "" : ""
        }`}
      >
        <span
          aria-hidden
          className={`text-lg w-5.5 text-center ${
            on ? "text-green [text-shadow:0_0_10px_rgba(0,255,136,.5)]" : "text-muted"
          }`}
        >
          {icon}
        </span>
        <span className="font-mono font-bold text-sm tracking-[0.18em] uppercase">
          {label}
        </span>
        <button
          type="button"
          onClick={onToggle}
          role="switch"
          aria-checked={on}
          className={`ml-auto inline-flex items-center gap-1.5 text-[0.6rem] tracking-[0.18em] uppercase cursor-pointer ${
            on ? "text-green" : "text-muted"
          }`}
        >
          {on ? "ON" : "OFF"}
          <span
            className={`block w-[26px] h-3.5 border relative transition-all ${
              on ? "bg-green/20 border-green" : "bg-panel-2 border-border"
            }`}
          >
            <span
              className="absolute top-px w-2.5 h-2.5 transition-all"
              style={{
                left: on ? 13 : 1,
                background: on ? "var(--green)" : "var(--muted)",
                boxShadow: on ? "0 0 8px var(--green)" : "none",
              }}
            />
          </span>
        </button>
      </div>
      <div className={on ? "" : "opacity-50 pointer-events-none"}>{input}</div>
      <div className="stamp mt-3">{meta}</div>
    </div>
  );
}
