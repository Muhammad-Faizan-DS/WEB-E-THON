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
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
        description="Your exams, grouped by what you can do now. Times are shown in Pakistan time (PKT)."
        actions={<Button variant="outline" size="sm" onClick={load}><RefreshCw /> Refresh</Button>}
      />
      {error && <Alert tone="warning" className="mb-4">{error}</Alert>}
      {!data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-48" />)}</div>
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
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {data[k].map((c) => <ExamCard key={c.examId} c={c} now={clock.now()} />)}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </>
  );
}

function Count({ n }: { n: number }) {
  return <span className="rounded-full bg-background px-1.5 text-xs tabular-nums text-muted-foreground">{n}</span>;
}

function Empty({ kind }: { kind: "available" | "upcoming" | "completed" }) {
  const text = {
    available: "No exams are open for you right now. Check the Upcoming tab for what's next.",
    upcoming: "Nothing scheduled. Your examiner will enrol you when an exam is set.",
    completed: "Exams you finish will appear here, with your results once they are published.",
  }[kind];
  return (
    <div className="grid place-items-center rounded-lg border border-dashed px-6 py-14 text-center">
      <Inbox className="size-8 text-muted-foreground" aria-hidden />
      <p className="mt-3 max-w-sm text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function ExamCard({ c, now }: { c: CandidateExamCard; now: number }) {
  const opensIn = Date.parse(c.opensAt) - now;
  const left = c.deadline ? Date.parse(c.deadline) - now : null;
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <p className="font-mono text-xs text-muted-foreground">{c.code}</p>
          <CandidateStatusBadge status={c.status} />
        </div>
        <CardTitle className="text-lg">{c.title}</CardTitle>
        <p className="text-sm text-muted-foreground">{c.examinerName}</p>
      </CardHeader>
      <CardContent className="flex-1">
        <dl className="grid grid-cols-3 gap-2 rounded-md bg-surface-2 p-3 text-center text-sm">
          <div><dt className="text-xs text-muted-foreground">Duration</dt><dd className="font-medium tabular-nums">{c.durationMin} min</dd></div>
          <div><dt className="text-xs text-muted-foreground">Marks</dt><dd className="font-medium tabular-nums">{c.totalMarks}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Questions</dt><dd className="font-medium tabular-nums">{c.questionCount}</dd></div>
        </dl>
        <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarClock className="size-4" aria-hidden />
          {fmtDateTime(c.opensAt)} – {fmtDateTime(c.closesAt)}
        </p>
        {c.phase === "scheduled" && (
          <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-info"><Clock3 className="size-4" aria-hidden />Opens {fmtRelative(opensIn)}</p>
        )}
        {left !== null && c.status === "in_progress" && (
          <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-primary"><Clock3 className="size-4" aria-hidden /><span className="font-mono">{fmtClock(left)}</span> left</p>
        )}
        {c.status === "results_published" && c.scorePct !== null && (
          <p className="mt-2 flex items-center gap-1.5 text-sm font-medium"><Trophy className="size-4 text-success" aria-hidden />Your score: {c.scorePct}%</p>
        )}
      </CardContent>
      <CardFooter>
        <CardAction c={c} />
      </CardFooter>
    </Card>
  );
}

function CardAction({ c }: { c: CandidateExamCard }) {
  if (c.phase === "scheduled") return <Button variant="secondary" disabled className="w-full"><Lock /> Not open yet</Button>;
  switch (c.status) {
    case "not_started":
    case "reattempt_granted":
      return <Button asChild className="w-full"><Link href={`/candidate/exams/${c.examId}`}>{c.status === "reattempt_granted" ? "Start re-attempt" : "View instructions"} <ArrowRight /></Link></Button>;
    case "in_progress":
      return <Button asChild className="w-full"><Link href={`/candidate/exams/${c.examId}`}>Resume exam <ArrowRight /></Link></Button>;
    case "locked":
      return <Button asChild variant="outline" className="w-full"><Link href={`/candidate/exams/${c.examId}`}><Lock /> See lock status</Link></Button>;
    case "submitted":
    case "expired":
      return c.attemptId ? <Button asChild variant="outline" className="w-full"><Link href={`/exam/${c.attemptId}/receipt`}><FileQuestion /> View receipt</Link></Button> : null;
    case "results_published":
      return c.attemptId ? <Button asChild className="w-full"><Link href={`/candidate/results/${c.attemptId}`}>View result <ArrowRight /></Link></Button>
        : <Button variant="outline" disabled className="w-full">Result available soon</Button>;
    default:
      return <Button variant="secondary" disabled className="w-full">Not available</Button>;
  }
}
