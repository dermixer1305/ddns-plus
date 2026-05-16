import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/records", label: "Records" },
  { href: "/domains", label: "Domains" },
  { href: "/providers", label: "Providers" },
  { href: "/settings", label: "Settings" },
  { href: "/logs", label: "Logs" },
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
  const user = await requireUser();

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
              {item.label}
            </Link>
          ))}
        </nav>
        <form action={logoutAction} className="mt-auto">
          <button className="ghost-button w-full" type="submit">Logout</button>
        </form>
      </aside>

      <section className="dashboard">
        <header className="topbar">
          <div>
            <p className="eyebrow">{eyebrow || `Signed in as ${user.name || user.username}`}</p>
            <h1>{title}</h1>
          </div>
          {action}
        </header>
        {children}
      </section>
    </main>
  );
}
