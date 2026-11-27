"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export function ExamSubnav({ examId, pendingRequests = 0 }: { examId: string; pendingRequests?: number }) {
  const path = usePathname();
  const items = [
    { href: `/examiner/exams/${examId}`, label: "Overview", exact: true },
    { href: `/examiner/exams/${examId}/monitor`, label: "Live monitor" },
    { href: `/examiner/exams/${examId}/requests`, label: "Requests", badge: pendingRequests },
  ];
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <Link href="/examiner" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Dashboard</Link>
      <nav aria-label="Exam sections" className="flex gap-1 overflow-x-auto rounded-lg bg-surface-2 p-1">
        {items.map((i) => {
          const active = i.exact ? path === i.href : path.startsWith(i.href);
          return (
            <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined}
              className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-muted-foreground", active && "bg-surface font-medium text-foreground shadow-sm")}>
              {i.label}
              {!!i.badge && <span className="rounded-full bg-flag px-1.5 text-xs font-semibold text-white">{i.badge}<span className="sr-only"> pending</span></span>}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
