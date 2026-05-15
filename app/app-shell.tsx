import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { getTranslator, TranslationKey } from "@/lib/i18n";

const navItems: Array<{ href: string; labelKey: TranslationKey }> = [
  { href: "/dashboard", labelKey: "nav.dashboard" },
  { href: "/records", labelKey: "nav.records" },
  { href: "/domains", labelKey: "nav.domains" },
  { href: "/providers", labelKey: "nav.providers" },
  { href: "/settings", labelKey: "nav.settings" },
  { href: "/logs", labelKey: "nav.logs" },
];

export async function AppShell({
  active,
  title,
  eyebrow,
  action,
  children,
}: {
  active: string;
  title: string;
  eyebrow?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [user, t] = await Promise.all([requireUser(), getTranslator()]);

  return (
    <main className="min-h-screen bg-[#090b10] text-zinc-100">
      <aside className="sidebar">
        <div className="flex items-center gap-3">
          <div className="logo-mark compact">D+</div>
          <div>
            <p className="text-lg font-semibold">DDNS+</p>
            <p className="text-xs text-zinc-500">Homelab DNS Control</p>
          </div>
        </div>
        <nav className="mt-10 grid gap-2 text-sm text-zinc-300">
          {navItems.map((item) => (
            <Link key={item.href} className={`nav-item ${active === item.href ? "active" : ""}`} href={item.href}>
              {t(item.labelKey)}
            </Link>
          ))}
        </nav>
        <form action={logoutAction} className="mt-auto">
          <button className="ghost-button w-full" type="submit">{t("common.logout")}</button>
        </form>
      </aside>

      <section className="dashboard">
        <header className="topbar">
          <div>
            <p className="eyebrow">{eyebrow || t("common.loggedInAs", { name: user.name || user.username })}</p>
            <h1>{title}</h1>
          </div>
          {action}
        </header>
        {children}
      </section>
    </main>
  );
}
