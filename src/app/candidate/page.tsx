"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock, Clock3, FileQuestion, Inbox, Lock, RefreshCw, Trophy } from "lucide-react";
import { CandidateExamList, type CandidateExamCard } from "@/contracts";
import { api, ApiError } from "@/lib/client/api";
import { useMe } from "@/lib/client/me";
import { useServerClock, useTick } from "@/lib/client/use-server-clock";
import { PageHeader } from "@/components/common/app-shell";
import { CandidateStatusBadge } from "@/components/common/status";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/misc";
import { fmtClock, fmtDateTime, fmtRelative } from "@/lib/utils";

export default function CandidateHome() {
  const { me } = useMe();
  const clock = useServerClock();
  const [data, setData] = React.useState<CandidateExamList | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  useTick(1000);

  const load = React.useCallback(async () => {
    const sent = Date.now();
    try {
      const d = await api.get("/api/me/exams", CandidateExamList);
      clock.sync(d.serverNow, sent);
      setData(d);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError && e.isNetwork ? "You're offline. Showing the last list we loaded." : "Couldn't load your exams.");
    }
  }, [clock]);

  React.useEffect(() => {
    const first = setTimeout(load, 0);
    const t = setInterval(load, 60_000); // upcoming → available on server time (step 15)
    return () => { clearTimeout(first); clearInterval(t); };
  }, [load]);

  const firstName = me.name.split(" ")[0];
  const defaultTab = data && data.available.length === 0 && data.upcoming.length > 0 ? "upcoming" : "available";

  return (
    <>
      <PageHeader
        title={`Hello, ${firstName}`}
        description="Your exams, grouped by what you can do now. All times are Pakistan time (PKT)."
        actions={<Button variant="outline" size="sm" onClick={load}><RefreshCw /> Refresh</Button>}
      />
      {error && <Alert tone="warning" className="mb-4">{error}</Alert>}
      {!data ? (
        <div className="space-y-3"><Skeleton className="h-10 w-80" />{[0, 1].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : (
        <Tabs defaultValue={defaultTab} key={defaultTab}>
          <TabsList aria-label="Exam groups">
            <TabsTrigger value="available">Available <Count n={data.available.length} /></TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming <Count n={data.upcoming.length} /></TabsTrigger>
            <TabsTrigger value="completed">Completed <Count n={data.completed.length} /></TabsTrigger>
          </TabsList>
          {(["available", "upcoming", "completed"] as const).map((k) => (
            <TabsContent key={k} value={k}>
              {data[k].length === 0 ? (
                <Empty kind={k} />
              ) : (
                <ul className="divide-y rounded-lg border bg-surface">
                  {data[k].map((c) => <ExamRow key={c.examId} c={c} now={clock.now()} />)}
                </ul>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </>
  );
}

function Count({ n }: { n: number }) {
  return <span className="num rounded-full bg-surface-2 px-1.5 text-xs text-muted-foreground">{n}</span>;
}

function Empty({ kind }: { kind: "available" | "upcoming" | "completed" }) {
  const text = {
    available: "No exams are open for you right now. Check Upcoming for what's next.",
    upcoming: "Nothing scheduled yet. Your examiner will enrol you when an exam is set.",
    completed: "Exams you finish appear here, with your result once it's published.",
  }[kind];
  return (
    <div className="rounded-lg border border-dashed px-6 py-14 text-center">
      <Inbox className="mx-auto size-6 text-subtle-foreground" aria-hidden />
      <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function ExamRow({ c, now }: { c: CandidateExamCard; now: number }) {
  const opensIn = Date.parse(c.opensAt) - now;
  const left = c.deadline ? Date.parse(c.deadline) - now : null;
  return (
    <li className="grid gap-x-8 gap-y-3 px-5 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-base font-semibold">{c.title}</h2>
          <span className="font-mono text-xs text-muted-foreground">{c.code}</span>
        </div>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {c.examinerName} · <span className="num">{c.durationMin} min · {c.questionCount} questions · {c.totalMarks} marks</span>
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <CandidateStatusBadge status={c.status} />
          <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <CalendarClock className="size-4" aria-hidden />
            <span className="num">{fmtDateTime(c.opensAt)} – {fmtDateTime(c.closesAt)}</span>
          </span>
          {c.phase === "scheduled" && <span className="text-[13px] font-medium">Opens {fmtRelative(opensIn)}</span>}
          {left !== null && c.status === "in_progress" && (
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium"><Clock3 className="size-4 text-primary" aria-hidden /><span className="num">{fmtClock(left)}</span> left</span>
          )}
          {c.status === "results_published" && c.scorePct !== null && (
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium"><Trophy className="size-4 text-success" aria-hidden />Score <span className="num">{c.scorePct}%</span></span>
          )}
        </div>
      </div>
      <div className="md:w-48"><CardAction c={c} /></div>
    </li>
  );
}

function CardAction({ c }: { c: CandidateExamCard }) {
  if (c.phase === "scheduled") return <Button variant="outline" disabled className="w-full"><Lock /> Not open yet</Button>;
  switch (c.status) {
    case "not_started":
    case "reattempt_granted":
      return <Button asChild className="w-full"><Link href={`/candidate/exams/${c.examId}`}>{c.status === "reattempt_granted" ? "Start re-attempt" : "Open exam"} <ArrowRight /></Link></Button>;
    case "in_progress":
      return <Button asChild className="w-full"><Link href={`/candidate/exams/${c.examId}`}>Resume <ArrowRight /></Link></Button>;
    case "locked":
      return <Button asChild variant="outline" className="w-full"><Link href={`/candidate/exams/${c.examId}`}><Lock /> Lock status</Link></Button>;
    case "submitted":
    case "expired":
      return c.attemptId ? <Button asChild variant="outline" className="w-full"><Link href={`/exam/${c.attemptId}/receipt`}><FileQuestion /> Receipt</Link></Button> : null;
    case "results_published":
      return c.attemptId ? <Button asChild className="w-full"><Link href={`/candidate/results/${c.attemptId}`}>View result <ArrowRight /></Link></Button>
        : <Button variant="outline" disabled className="w-full">Result coming soon</Button>;
    default:
      return <Button variant="outline" disabled className="w-full">Not available</Button>;
  }
}
