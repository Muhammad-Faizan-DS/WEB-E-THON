import Link from "next/link";
import type { ReactNode } from "react";
import { SignOutButton } from "@/components/backend-preview/sign-in";
import { roleHome, roleLabel, type SignedInUser } from "./guard";

/** Temporary shell for the role dashboards. Replace with the frontend team's AppShell. */
export function DashboardShell({ user, children }: { user: SignedInUser; children: ReactNode }) {
  return <div>
    <a className="skip" href="#workspace">Skip to workspace</a>
    <header className="topbar">
      <Link href={roleHome(user.role)} className="brand"><span aria-hidden="true">SE</span>SecureExam</Link>
      <div className="account">
        <div><strong>{user.name}</strong><small>{roleLabel[user.role]}</small></div>
        <SignOutButton />
      </div>
    </header>
    <main id="workspace" className="workspace">{children}</main>
  </div>;
}

export function StatGrid({ items }: { items: Array<{ label: string; value: number | string; hint?: string }> }) {
  return <dl className="stats">{items.map((item) =>
    <div key={item.label} className="stat"><dt>{item.label}</dt><dd>{item.value}</dd>{item.hint && <small>{item.hint}</small>}</div>)}
  </dl>;
}

export function ToolLinks({ title = "Tools", links }: { title?: string; links: Array<{ href: string; label: string; note: string }> }) {
  return <section className="panel"><h2>{title}</h2>
    <ul className="tools">{links.map((link) =>
      <li key={link.href}><Link href={link.href}>{link.label}</Link><small>{link.note}</small></li>)}
    </ul>
  </section>;
}
