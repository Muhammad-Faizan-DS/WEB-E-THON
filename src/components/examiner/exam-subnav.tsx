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
    <div className="mb-8 border-b">
      <Link href="/examiner" className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Dashboard</Link>
      <nav aria-label="Exam sections" className="flex gap-6 overflow-x-auto">
        {items.map((i) => {
          const active = i.exact ? path === i.href : path.startsWith(i.href);
          return (
            <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined}
              className={cn("-mb-px inline-flex h-10 items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent text-sm text-muted-foreground transition-colors hover:text-foreground", active && "border-foreground font-medium text-foreground")}>
              {i.label}
              {!!i.badge && <span className="num rounded-full bg-foreground px-1.5 text-[11px] font-semibold text-background">{i.badge}<span className="sr-only"> pending</span></span>}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
