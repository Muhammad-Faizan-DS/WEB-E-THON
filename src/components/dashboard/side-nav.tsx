"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/contracts/core";

// Minimal stroke icons (24×24, lucide-style paths) so the bundle needs no icon library.
const icons = {
  home: "M3 10.5 12 3l9 7.5V21H3z M9 21v-6h6v6",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
  monitor: "M2 4h20v13H2z M8 21h8 M12 17v4",
  inbox: "M22 12h-6l-2 3h-4l-2-3H2 M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",
  flag: "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z M4 22v-7",
  log: "M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01",
  plus: "M12 5v14 M5 12h14",
  award: "M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M8.21 13.89 7 23l5-3 5 3-1.21-9.12",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
} as const;
type Icon = keyof typeof icons;

const menus: Record<Role, Array<[string, string, Icon]>> = {
  admin: [["Dashboard", "/admin", "home"], ["Users", "/admin/users", "users"], ["Exam oversight", "/admin/exams", "monitor"],
    ["Re-attempt requests", "/admin/requests", "inbox"], ["Disputes", "/admin/disputes", "flag"], ["Audit log", "/admin/audit", "log"]],
  examiner: [["Exams", "/examiner", "home"], ["Create exam", "/examiner/exams/new", "plus"], ["Re-attempt requests", "/examiner/requests", "inbox"],
    ["Disputes", "/examiner/disputes", "flag"]],
  candidate: [["My exams", "/candidate", "home"], ["Results", "/candidate/results", "award"], ["Disputes", "/candidate/disputes", "flag"],
    ["Workspace settings", "/candidate/settings", "settings"]],
};

export function SvgIcon({ name }: { name: Icon }) {
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {icons[name].split(" M").map((d, index) => <path key={index} d={index ? "M" + d : d} />)}</svg>;
}

export function SideNav({ role }: { role: Role }) {
  const path = usePathname();
  const items = menus[role];
  // The longest matching prefix wins, so /examiner/exams/123 highlights "Exams" but /examiner/exams/new highlights "Create exam".
  const current = items.map(([, href]) => href).filter((href) => path === href || path.startsWith(href + "/"))
    .sort((a, b) => b.length - a.length)[0];
  return <nav className="side-nav" aria-label="Main">
    {items.map(([label, href, icon]) => <Link key={href} href={href} aria-current={href === current ? "page" : undefined}>
      <SvgIcon name={icon} /><span>{label}</span></Link>)}
  </nav>;
}
