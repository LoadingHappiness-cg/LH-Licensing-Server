import Link from "next/link";
import { ReactNode } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/customers", label: "Customers" },
  { href: "/products", label: "Products" },
  { href: "/license-plans", label: "License Plans" },
  { href: "/licenses", label: "Licenses" },
  { href: "/installations", label: "Installations" },
  { href: "/audit-events", label: "Audit Events" }
];

export function AdminShell({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">LH</div>
          <div>
            <div className="brand-title">Licensing Server</div>
            <div className="brand-subtitle">Internal admin</div>
          </div>
        </div>

        <nav className="nav">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="nav-link">
              {item.label}
            </Link>
          ))}
        </nav>

        <a className="btn secondary full-width" href="/api/auth/signout?callbackUrl=/login">
          Sign out
        </a>
      </aside>

      <main className="content">
        <header className="page-header">
          <div>
            <p className="eyebrow">Loading Happiness</p>
            <h1>{title}</h1>
            {subtitle ? <p className="subtitle">{subtitle}</p> : null}
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}
