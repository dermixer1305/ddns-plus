import { loginAction, setupAction } from "@/app/actions";

export function formatDate(date?: Date | null) {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}

export function formatDateOrNever(date: Date | null | undefined) {
  return date ? formatDate(date) : "Never";
}

export function formatRelativeTime(date: Date | null | undefined) {
  if (!date) return "Unknown";

  const seconds = Math.ceil((date.getTime() - Date.now()) / 1000);
  if (seconds <= 0) return "due now";

  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `in ${minutes} min`;

  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `in ${hours} h`;

  return `in ${Math.ceil(hours / 24)} days`;
}

export function formatDueTime(date: Date | null | undefined) {
  if (!date) return "no active records";

  const secondsOverdue = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secondsOverdue < 0) return `${formatDate(date)} (${formatRelativeTime(date)})`;
  if (secondsOverdue < 60) return "due now";

  const minutes = Math.floor(secondsOverdue / 60);
  if (minutes < 60) return `overdue by ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  return `overdue by ${hours} h`;
}

export function getNextRefresh(records: Array<{ enabled: boolean; lastCheckedAt: Date | null }>, seconds: number) {
  const enabledRecords = records.filter((record) => record.enabled);
  if (enabledRecords.length === 0) return null;

  const uncheckedRecord = enabledRecords.find((record) => !record.lastCheckedAt);
  if (uncheckedRecord) return new Date();

  return new Date(
    Math.min(...enabledRecords.map((record) => record.lastCheckedAt!.getTime() + seconds * 1000)),
  );
}

export function statusClass(status: string) {
  const map: Record<string, string> = {
    OK: "bg-emerald-500/12 text-emerald-300 ring-emerald-400/20",
    CHANGED: "bg-sky-500/12 text-sky-300 ring-sky-400/20",
    ERROR: "bg-rose-500/12 text-rose-300 ring-rose-400/20",
    SKIPPED: "bg-zinc-500/12 text-zinc-300 ring-zinc-400/20",
    PENDING: "bg-amber-500/12 text-amber-300 ring-amber-400/20",
  };
  return map[status] || map.PENDING;
}

export function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="panel p-5">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className={`mt-3 text-3xl font-semibold tracking-tight ${tone || "text-zinc-50"}`}>{value}</p>
    </div>
  );
}

export function TextInput({
  name,
  label,
  type = "text",
  placeholder,
  defaultValue,
  required,
}: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string | number | null;
  required?: boolean;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input name={name} type={type} placeholder={placeholder} defaultValue={defaultValue ?? ""} required={required} />
    </label>
  );
}

export function SelectInput({
  name,
  label,
  defaultValue,
  options,
}: {
  name: string;
  label: string;
  defaultValue: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select name={name} defaultValue={defaultValue}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

export function AuthShell({ mode }: { mode: "setup" | "login" }) {
  const isSetup = mode === "setup";

  return (
    <main className="auth-shell">
      <section className="auth-brand">
        <div className="logo-mark">D+</div>
        <p className="eyebrow">Self-hosted Dynamic DNS</p>
        <h1>DDNS+</h1>
        <p>Lean management for DNS providers, automatic IP detection, update status, and logs in a local web interface.</p>
      </section>

      <section className="panel auth-panel">
        <p className="eyebrow">{isSetup ? "Initial setup" : "Sign in"}</p>
        <h2>{isSetup ? "Create admin account" : "Welcome back"}</h2>
        <form action={isSetup ? setupAction : loginAction} className="stack">
          <TextInput name="username" label="Username" placeholder="admin" required />
          <TextInput name="password" label="Password" type="password" required />
          <button className="primary-button" type="submit">
            {isSetup ? "Set up DDNS+" : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
