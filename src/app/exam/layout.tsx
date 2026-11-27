"use client";
import { MeProvider } from "@/lib/client/me";
import { Skeleton } from "@/components/ui/misc";

export default function ExamLayout({ children }: { children: React.ReactNode }) {
  return (
    <MeProvider role={["candidate", "examiner"]} fallback={<div className="space-y-4 p-6"><Skeleton className="h-12" /><Skeleton className="h-96" /></div>}>
      {children}
    </MeProvider>
  );
}
