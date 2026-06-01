import { useEffect, useState } from "react";
import { Modal } from "../Modal";
import { Field, FieldLabel } from "../Field";
import { Button } from "../Button";

export interface ReminderSub {
  enabled: boolean;
  emailEnabled: boolean;
  email: string;
  telegramEnabled: boolean;
  telegram: string;
  leadSeconds: number;
  frequencySeconds: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  subscription: ReminderSub;
  onSave: (next: ReminderSub) => void;
  onDisable: () => void;
}

export function RemindersModal({ open, onClose, subscription, onSave, onDisable }: Props) {
  const [draft, setDraft] = useState<ReminderSub>(subscription);
  useEffect(() => setDraft(subscription), [subscription, open]);

  const anyOn = draft.emailEnabled || draft.telegramEnabled;

  function save() {
    if (!anyOn) {
      alert(
        "at least one channel (email or telegram) must be enabled — or click DISABLE to mute reminders entirely.",
      );
      return;
    }
    onSave({ ...draft, enabled: true });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      titleId="m-reminders-title"
      maxWidth="620px"
      tag={
        <>
          <span className="text-green">▸</span> POST · /functions/v1/subscribe
        </>
      }
      title={<>REMINDER SETTINGS</>}
      subtitle={
        <>
          off-chain · advisory only · status:{" "}
          <span
            className={
              subscription.enabled && anyOn ? "text-green font-bold" : "text-amber font-bold"
            }
          >
            {subscription.enabled && anyOn ? "ENABLED" : "DISABLED"}
          </span>
        </>
      }
      footer={
        <>
          {subscription.enabled && (
            <Button variant="danger" onClick={onDisable}>
              DISABLE
            </Button>
          )}
          <span className="flex-1" />
          <Button onClick={onClose}>CANCEL</Button>
          <Button variant="primary" onClick={save}>
            ▸ SAVE
          </Button>
        </>
      }
    >
      <FieldLabel>CHANNELS · toggle each independently</FieldLabel>
      <div className="grid grid-cols-1 gap-3">
        <ChannelRow
          on={draft.emailEnabled}
          icon="✉"
          label="EMAIL"
          value={draft.email || "(set address)"}
          onToggle={() =>
            setDraft({ ...draft, emailEnabled: !draft.emailEnabled })
          }
          input={
            <Field
              type="email"
              placeholder="owner@example.com"
              value={draft.email}
              disabled={!draft.emailEnabled}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            />
          }
        />
        <ChannelRow
          on={draft.telegramEnabled}
          icon="◉"
          label="TELEGRAM"
          value={
            draft.telegram
              ? `chat ${draft.telegram}`
              : "(set chat id)"
          }
          onToggle={() =>
            setDraft({ ...draft, telegramEnabled: !draft.telegramEnabled })
          }
          input={
            <Field
              placeholder="chat id (DM @solswitch_bot first)"
              value={draft.telegram}
              disabled={!draft.telegramEnabled}
              onChange={(e) => setDraft({ ...draft, telegram: e.target.value })}
            />
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-3 mt-2">
        <div>
          <FieldLabel>LEAD TIME</FieldLabel>
          <select
            value={draft.leadSeconds}
            onChange={(e) =>
              setDraft({ ...draft, leadSeconds: parseInt(e.target.value) })
            }
            className="w-full bg-[#050505] border border-border px-3.5 py-2.5 font-mono text-text text-sm outline-none focus:border-green focus:shadow-[0_0_0_1px_var(--green)]"
          >
            <option value={3600}>1 HOUR</option>
            <option value={21600}>6 HOURS</option>
            <option value={86400}>24 HOURS</option>
            <option value={259200}>3 DAYS</option>
          </select>
        </div>
        <div>
          <FieldLabel>REPEAT EVERY</FieldLabel>
          <select
            value={draft.frequencySeconds}
            onChange={(e) =>
              setDraft({ ...draft, frequencySeconds: parseInt(e.target.value) })
            }
            className="w-full bg-[#050505] border border-border px-3.5 py-2.5 font-mono text-text text-sm outline-none focus:border-green focus:shadow-[0_0_0_1px_var(--green)]"
          >
            <option value={900}>15 MIN</option>
            <option value={3600}>1 HOUR</option>
            <option value={21600}>6 HOURS</option>
            <option value={0}>DO NOT REPEAT</option>
          </select>
        </div>
      </div>

      <div className="bg-green/[.04] border border-green/[.18] border-l-2 border-l-green px-3.5 py-3 text-xs leading-relaxed text-muted">
        <strong className="text-green">ⓘ not part of enforcement.</strong> contact
        info lives in Supabase (RLS-locked). the on-chain{" "}
        <code className="text-green">claim</code> still requires the time gate even
        if reminders fail.
      </div>
    </Modal>
  );
}

function ChannelRow({
  on,
  icon,
  label,
  value,
  onToggle,
  input,
}: {
  on: boolean;
  icon: string;
  label: string;
  value: string;
  onToggle: () => void;
  input: React.ReactNode;
}) {
  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={onToggle}
        className={`flex items-center gap-3.5 px-3.5 py-3 border bg-panel-2 transition-all cursor-pointer hover:border-green/25 ${
          on ? "border-green/35 bg-[#0a100c]" : "border-border"
        }`}
      >
        <span aria-hidden className={`w-4.5 text-center ${on ? "text-green" : "text-muted"}`}>
          {icon}
        </span>
        <span className="font-mono font-bold text-[0.75rem] tracking-[0.18em] uppercase w-20">
          {label}
        </span>
        <span className="text-text font-mono text-sm flex-1 text-left">{value}</span>
        <span
          className={`block w-6 h-3 border relative ml-auto transition-all ${
            on ? "bg-green/20 border-green" : "bg-panel border-border"
          }`}
        >
          <span
            className="absolute top-px w-2 h-2 transition-all"
            style={{
              left: on ? 13 : 1,
              background: on ? "var(--green)" : "var(--muted)",
              boxShadow: on ? "0 0 6px var(--green)" : "none",
            }}
          />
        </span>
      </button>
      <div className={on ? "pl-0" : "pl-0 opacity-50 pointer-events-none"}>{input}</div>
    </>
  );
}
