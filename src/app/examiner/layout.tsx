"use client";
import { MeProvider } from "@/lib/client/me";
import { AppShell, ShellSkeleton } from "@/components/common/app-shell";

const NAV = [
  { href: "/examiner", label: "Dashboard" },
  { href: "/examiner/exams/new", label: "New exam" },
];

export default function ExaminerLayout({ children }: { children: React.ReactNode }) {
  return (
    <MeProvider role={["examiner", "admin"]} fallback={<ShellSkeleton />}>
      <AppShell nav={NAV}>{children}</AppShell>
    </MeProvider>
  );
}
