import { loginAction, setupAction } from "@/app/actions";
import { TranslationKey } from "@/lib/i18n";

type TFunction = (key: TranslationKey, replacements?: Record<string, string | number>) => string;

export function formatDate(date?: Date | null, locale = "de") {
  if (!date) return "";
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "de-DE", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}

export function formatDateOrNever(date: Date | null | undefined, t: TFunction, locale: string) {
  return date ? formatDate(date, locale) : t("common.never");
}

export function formatRelativeTime(date: Date | null | undefined, t: TFunction) {
  if (!date) return t("common.unknown");

  const seconds = Math.ceil((date.getTime() - Date.now()) / 1000);
  if (seconds <= 0) return t("common.nowDue");

  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return t("common.inMinutes", { count: minutes });

  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return t("common.inHours", { count: hours });

  return t("common.inDays", { count: Math.ceil(hours / 24) });
}

export function formatDueTime(date: Date | null | undefined, t: TFunction, locale: string) {
  if (!date) return t("common.noActiveRecords");

  const secondsOverdue = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secondsOverdue < 0) return `${formatDate(date, locale)} (${formatRelativeTime(date, t)})`;
  if (secondsOverdue < 60) return t("common.nowDue");

  const minutes = Math.floor(secondsOverdue / 60);
  if (minutes < 60) return t("common.overdueMinutes", { count: minutes });

  const hours = Math.floor(minutes / 60);
  return t("common.overdueHours", { count: hours });
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

export function AuthShell({ mode, t }: { mode: "setup" | "login"; t: TFunction }) {
  const isSetup = mode === "setup";

  return (
    <main className="auth-shell">
      <section className="auth-brand">
        <div className="logo-mark">D+</div>
        <p className="eyebrow">{t("auth.eyebrow")}</p>
        <h1>DDNS+</h1>
        <p>{t("auth.description")}</p>
      </section>

      <section className="panel auth-panel">
        <p className="eyebrow">{isSetup ? t("auth.setupEyebrow") : t("auth.loginEyebrow")}</p>
        <h2>{isSetup ? t("auth.setupTitle") : t("auth.loginTitle")}</h2>
        <form action={isSetup ? setupAction : loginAction} className="stack">
          <TextInput name="username" label={t("auth.username")} placeholder="admin" required />
          <TextInput name="password" label={t("auth.password")} type="password" required />
          <button className="primary-button" type="submit">
            {isSetup ? t("auth.setupButton") : t("auth.loginButton")}
          </button>
        </form>
      </section>
    </main>
  );
}
