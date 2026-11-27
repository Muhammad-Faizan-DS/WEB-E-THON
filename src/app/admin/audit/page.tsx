"use client";
import * as React from "react";
import { Search } from "lucide-react";
import { api, ApiError } from "@/lib/client/api";
import { AuditLog, type AuditEntry } from "@/lib/client/admin";
import { PageHeader } from "@/components/common/app-shell";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/misc";
import { fmtDateTime, fmtTime } from "@/lib/utils";

export default function AdminAudit() {
  const [entries, setEntries] = React.useState<AuditEntry[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    api.get("/api/admin/audit", AuditLog).then((d) => setEntries(d.entries), (e: ApiError) => setError(e.message));
  }, []);

  const q = query.trim().toLowerCase();
  const shown = (entries ?? []).filter((e) => !q || `${e.action} ${e.target} ${e.by} ${e.note}`.toLowerCase().includes(q));

  return (
    <>
      <PageHeader title="Audit log" description="Every sensitive action, who did it and when: account changes, password resets, extra time, request decisions and early closes. Entries can't be edited." />
      {error && <Alert tone="danger" title="Couldn't load the audit log" className="mb-6">{error}</Alert>}
      <div className="relative mb-4 sm:w-80">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input aria-label="Search the audit log" placeholder="Search action, person or note" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
      </div>
      {!entries && !error ? (
        <div className="space-y-2"><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
      ) : (
        <ol className="divide-y rounded-lg border bg-surface">
          {shown.map((e) => (
            <li key={e.id} className="grid gap-1 px-4 py-3 sm:grid-cols-[9.5rem_1fr] sm:gap-4">
              <time dateTime={e.at} className="num font-mono text-[12px] text-muted-foreground">{fmtDateTime(e.at)} · {fmtTime(e.at)}</time>
              <div className="min-w-0">
                <p className="text-sm"><span className="font-medium">{e.action}</span> · {e.target}</p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">{e.by}{e.note ? ` · ${e.note}` : ""}</p>
              </div>
            </li>
          ))}
          {entries && shown.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted-foreground">No entries match.</li>}
        </ol>
      )}
    </>
  );
}
