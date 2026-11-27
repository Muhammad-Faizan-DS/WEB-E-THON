"use client";
import { MeProvider } from "@/lib/client/me";
import { AppShell, ShellSkeleton } from "@/components/common/app-shell";

const NAV = [
  { href: "/candidate", label: "My exams" },
  { href: "/candidate/settings", label: "Workspace settings" },
];

export default function CandidateLayout({ children }: { children: React.ReactNode }) {
  return (
    <MeProvider role="candidate" fallback={<ShellSkeleton />}>
      <AppShell nav={NAV}>{children}</AppShell>
    </MeProvider>
  );
}
