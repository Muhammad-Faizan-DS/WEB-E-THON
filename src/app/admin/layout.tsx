"use client";
import { MeProvider } from "@/lib/client/me";
import { AppShell, ShellSkeleton } from "@/components/common/app-shell";

const NAV = [
  { href: "/admin", label: "Accounts" },
  { href: "/admin/audit", label: "Audit log" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <MeProvider role="admin" fallback={<ShellSkeleton />}>
      <AppShell nav={NAV}>{children}</AppShell>
    </MeProvider>
  );
}
