"use client";
import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Eraser, Flag, LayoutGrid, Loader2, Megaphone, PanelRightClose, PanelRightOpen, Send,
} from "lucide-react";
import { useExamEngine } from "@/lib/client/exam-engine";
import { useMe } from "@/lib/client/me";
import { useTick } from "@/lib/client/use-server-clock";
import { useMedia } from "@/lib/client/use-media";
import { useIsFullscreen } from "@/lib/client/use-browser";
import { enterFullscreen } from "@/lib/client/exam-session";
import { ExamTimer } from "@/components/exam/timer";
import { OfflineBanner, SaveStatus } from "@/components/exam/status-pills";
import { Navigator } from "@/components/exam/navigator";
import { QuestionView } from "@/components/exam/question-view";
import { ReviewPanel } from "@/components/exam/review-panel";
import { TEXT_SIZES, ToolsTabs } from "@/components/exam/tools-panel";
import { FullscreenGate, LockedPanel, SupersededPanel } from "@/components/exam/overlays";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/misc";
import { HelpButton } from "@/components/exam/help-panel";
import { useInbox } from "@/lib/client/proctor";
import { api as apiClient } from "@/lib/client/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function WorkspacePage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const router = useRouter();
  const { me, setPreferences } = useMe();
  const prefs = me.preferences;
  const ex = useExamEngine(attemptId, me.id);
  const isLg = useMedia("(min-width: 1024px)");

  const [current, setCurrent] = React.useState(() => (typeof window === "undefined" ? 0 : Number(sessionStorage.getItem(`fm:current:${attemptId}`) ?? 0)));
  const [visitedState, setVisited] = React.useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try { return new Set(JSON.parse(sessionStorage.getItem(`fm:visited:${attemptId}`) ?? "[]") as string[]); } catch { return new Set(); }
  });
  const [view, setView] = React.useState<"question" | "review">("question");
  const [navOpen, setNavOpen] = React.useState(false);
  const [toolsOpen, setToolsOpen] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const isFullscreen = useIsFullscreen();
  const [dismissedAnn, setDismissedAnn] = React.useState<string | null>(null);
  const mainRef = React.useRef<HTMLDivElement>(null);

  // guide feature: private messages and help requests with the examiner, plus announcement read receipts
  const inboxOn = ex.status === "in_progress" || ex.status === "locked";
  const help = useInbox(attemptId, inboxOn);
  const lastToasted = React.useRef<string | null | undefined>(undefined);
  React.useEffect(() => {
    const m = help.latestFromExaminer;
    if (lastToasted.current === undefined) { lastToasted.current = m?.id ?? null; return; } // first load: no toast for old messages
    if (m && m.id !== lastToasted.current) {
      lastToasted.current = m.id;
      toast.info(m.kind === "reminder" ? "Reminder from your examiner" : "Message from your examiner", { description: m.body, duration: 12000 });
    }
  }, [help.latestFromExaminer]);
  const acknowledge = React.useCallback(async (annId: string) => {
    setDismissedAnn(annId);
    try { await apiClient.post(`/api/attempts/${attemptId}/announcements/${annId}/ack`); help.reload(); } catch { /* offline: the banner is dismissed locally; the examiner sees it as not yet acknowledged */ }
  }, [attemptId, help]);

  const questions = React.useMemo(() => ex.attempt?.questions ?? [], [ex.attempt]);
  const q = questions[Math.min(current, Math.max(0, questions.length - 1))];

  // the question on screen counts as visited (derived, persisted on navigation)
  const visited = React.useMemo(() => (q ? new Set(visitedState).add(q.aqId) : visitedState), [visitedState, q]);

  const go = React.useCallback((i: number) => {
    const next = Math.max(0, Math.min(questions.length - 1, i));
    setCurrent(next);
    sessionStorage.setItem(`fm:current:${attemptId}`, String(next));
    setVisited((s) => {
      const n = new Set(s);
      if (q) n.add(q.aqId);
      if (questions[next]) n.add(questions[next].aqId);
      sessionStorage.setItem(`fm:visited:${attemptId}`, JSON.stringify([...n]));
      return n;
    });
    setView("question");
    setNavOpen(false);
    requestAnimationFrame(() => mainRef.current?.focus());
  }, [questions, q, attemptId]);

  // finalized → receipt
  React.useEffect(() => {
    if (ex.phase === "finalized") {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      router.replace(`/exam/${attemptId}/receipt`);
    }
  }, [ex.phase, attemptId, router]);

  // ---------- browser observations (hints only, PRD §8) ----------
  const policy = ex.attempt?.policy;
  const { logEvent, toggleFlag } = ex;
  React.useEffect(() => {
    if (ex.phase !== "ready") return;
    const vis = () => logEvent(document.hidden ? "visibility_hidden" : "visibility_visible");
    const blur = () => logEvent("window_blur");
    const focus = () => logEvent("window_focus");
    const fs = () => logEvent(document.fullscreenElement ? "fullscreen_enter" : "fullscreen_exit");
    let rt: ReturnType<typeof setTimeout>;
    const resize = () => { clearTimeout(rt); rt = setTimeout(() => logEvent("resize", { w: innerWidth, h: innerHeight }), 1000); };
    document.addEventListener("visibilitychange", vis);
    addEventListener("blur", blur);
    addEventListener("focus", focus);
    document.addEventListener("fullscreenchange", fs);
    addEventListener("resize", resize);
    return () => {
      document.removeEventListener("visibilitychange", vis);
      removeEventListener("blur", blur);
      removeEventListener("focus", focus);
      document.removeEventListener("fullscreenchange", fs);
      removeEventListener("resize", resize);
    };
  }, [ex.phase, logEvent]);

  // keyboard shortcuts
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || !q) return;
      const k = e.key.toLowerCase();
      if (e.key === "ArrowRight") { e.preventDefault(); go(current + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(current - 1); }
      else if (k === "f") { e.preventDefault(); toggleFlag(q.aqId); }
      else if (k === "r") { e.preventDefault(); setView("review"); }
      else if (k === "t") { e.preventDefault(); setToolsOpen((o) => !o); }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [q, current, go, toggleFlag]);

  // ---------- render states ----------
  if (ex.phase === "loading" || ex.phase === "finalized") {
    return <div className="space-y-4 p-6"><Skeleton className="h-14" /><div className="grid gap-6 lg:grid-cols-[16rem_1fr]"><Skeleton className="h-80" /><Skeleton className="h-96" /></div></div>;
  }
  if (ex.phase === "error" || !ex.attempt || !q || !policy) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <Alert tone="danger" title="Can't open the exam">{ex.loadError}</Alert>
        <Button className="mt-4" onClick={ex.reload}>Try again</Button>
      </div>
    );
  }

  const a = ex.answers[q.aqId];
  const locked = ex.status === "locked";
  const closed = ex.status !== "in_progress" && !locked;
  const needFullscreen = policy.fullscreenRequired && !isFullscreen && !locked && ex.activeSession;
  const inputsDisabled = closed || locked || !ex.activeSession || ex.submitting;
  const latestAnn = ex.announcements.at(-1);
  const navSide = prefs.navigatorPosition;

  const nav = <Navigator questions={questions} answers={ex.answers} visited={visited} current={current} onJump={go} />;
  const tools = <ToolsTabs storageKey={`fm:${me.id}:${attemptId}:scratch`} prefs={prefs} onPrefs={setPreferences} />;

  let main: React.ReactNode;
  if (!ex.activeSession) main = <SupersededPanel onTakeOver={ex.takeOver} />;
  else if (locked) main = <LockedPanel attemptId={attemptId} request={ex.pendingRequest} onSent={ex.refreshStatus} />;
  else if (needFullscreen) main = <FullscreenGate onEnter={() => enterFullscreen()} />;
  else if (view === "review") main = <ReviewPanel questions={questions} answers={ex.answers} onJump={go} onBack={() => setView("question")} onSubmit={() => setConfirmOpen(true)} />;
  else
    main = (
      <div className="mx-auto w-full max-w-3xl rounded-lg border bg-surface px-5 py-6 shadow-sm sm:px-10 sm:py-9">
        <QuestionView
          key={q.aqId}
          q={q}
          total={questions.length}
          answer={a}
          onChange={(v, d) => ex.setAnswer(q.aqId, v, d)}
          pastePolicy={policy.pastePolicy}
          split={prefs.layout === "split"}
          disabled={inputsDisabled}
          onPaste={(chars, outcome) => logEvent("paste", { aqId: q.aqId, position: q.position, chars, outcome })}
          onCopyBlocked={() => logEvent("copy_blocked", { aqId: q.aqId })}
        />
      </div>
    );

  const showFooter = view === "question" && ex.activeSession && !locked && !needFullscreen;

  return (
    <div className="flex h-dvh flex-col" style={{ ["--q-size" as string]: TEXT_SIZES[prefs.textSize] }}>
      {/* top bar */}
      <header className="z-20 border-b bg-surface">
        <div className="relative flex h-14 items-center gap-3 px-3 sm:px-5">
          <svg viewBox="0 0 20 20" className="hidden size-5 shrink-0 text-primary md:block" aria-hidden>
            <rect x="1.5" y="1.5" width="17" height="17" rx="3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="m5.6 10.4 2.9 2.9 5.9-6.6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="min-w-0 flex-1 md:flex-none md:max-w-[30%]">
            <h1 className="truncate font-sans text-[13px] font-semibold leading-tight tracking-normal">{ex.attempt.examTitle}{ex.attempt.isSandbox && <span className="ml-2 font-normal text-info">Preview</span>}</h1>
            <p className="truncate text-[12px] text-muted-foreground">{me.name}</p>
          </div>
          {ex.deadline && (
            <div className="md:absolute md:left-1/2 md:-translate-x-1/2">
              <CountdownContainer deadline={ex.deadline} now={ex.now} totalMs={ex.attempt.durationMin * 60000} onExpire={ex.status === "in_progress" ? ex.submit : undefined} />
            </div>
          )}
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <SaveStatus connection={ex.connection} pendingCount={ex.pendingCount} rejectedCount={ex.rejectedCount} saving={false} lastAckAt={ex.lastAckAt} compact />
            <Button variant="ghost" size="icon-sm" className="hidden lg:inline-flex" onClick={() => setToolsOpen((o) => !o)} aria-pressed={toolsOpen} aria-label={toolsOpen ? "Hide tools" : "Show scratchpad and display tools"}>
              {toolsOpen ? <PanelRightClose /> : <PanelRightOpen />}
            </Button>
            {inboxOn && ex.activeSession && <HelpButton attemptId={attemptId} messages={help.inbox.messages} unread={help.unread} onOpen={help.markRead} onSent={help.reload} />}
            <Button size="sm" className="hidden sm:inline-flex" onClick={() => setView("review")} disabled={inputsDisabled}>Review &amp; submit</Button>
          </div>
        </div>
        {ex.attempt.isSandbox && <p className="border-t bg-info-soft px-5 py-1.5 text-[12px] font-medium text-info">Sandbox preview: nothing you do here is recorded or counted.</p>}
      </header>
      <OfflineBanner connection={ex.connection} pendingCount={ex.pendingCount} />
      {latestAnn && dismissedAnn !== latestAnn.id && !help.inbox.acked.includes(latestAnn.id) && (
        <div role="status" aria-live="polite" className="flex items-start gap-2.5 border-b bg-primary-soft px-5 py-2.5 text-[13px]">
          <Megaphone className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <p className="flex-1"><b>From your examiner:</b> {latestAnn.body}</p>
          <Button size="sm" variant="outline" className="h-7 shrink-0 px-2.5 text-[12px]" onClick={() => acknowledge(latestAnn.id)}>Got it</Button>
        </div>
      )}

      <div className={cn("flex min-h-0 flex-1", navSide === "right" && "flex-row-reverse")}>
        <aside className={cn("hidden w-64 shrink-0 overflow-y-auto bg-background px-5 py-6 lg:block", navSide === "left" ? "border-r" : "border-l")}>
          <h2 className="mb-4 text-[13px] font-semibold">Questions</h2>
          {nav}
        </aside>
        <main ref={mainRef} tabIndex={-1} className="min-w-0 flex-1 overflow-y-auto px-3 py-6 outline-none sm:px-8 sm:py-10" aria-label="Exam question">
          {closed && <Alert tone="info" className="mx-auto mb-4 max-w-4xl" title="This attempt has ended">Your accepted answers were submitted.</Alert>}
          {main}
        </main>
        {toolsOpen && isLg && (
          <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-l bg-surface px-5 py-6 xl:w-96" aria-label="Tools">{tools}</aside>
        )}
      </div>

      {showFooter && (
        <footer className="z-10 border-t bg-surface">
          <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-2.5 sm:px-0">
            <Button variant="outline" onClick={() => go(current - 1)} disabled={current === 0} aria-label="Previous question"><ArrowLeft /> <span className="hidden sm:inline">Previous</span></Button>
            <Button variant="outline" className="num lg:hidden" onClick={() => setNavOpen(true)}><LayoutGrid /> {current + 1}/{questions.length}</Button>
            <div className="flex-1" />
            <Button variant="ghost" onClick={() => ex.setAnswer(q.aqId, null, 0)} disabled={inputsDisabled || !a?.value} className="hidden text-muted-foreground sm:inline-flex"><Eraser /> Clear</Button>
            <Button variant={a?.flagged ? "flag" : "outline"} onClick={() => ex.toggleFlag(q.aqId)} aria-pressed={!!a?.flagged} disabled={inputsDisabled}>
              <Flag className={cn(a?.flagged && "fill-current")} /> <span className="hidden sm:inline">{a?.flagged ? "Marked for review" : "Mark for review"}</span>
            </Button>
            <Button variant="outline" size="icon" className="lg:hidden" onClick={() => setToolsOpen(true)} aria-label="Scratchpad and display tools"><PanelRightOpen /></Button>
            {current < questions.length - 1 ? (
              <Button onClick={() => go(current + 1)}>Next <ArrowRight /></Button>
            ) : (
              <Button onClick={() => setView("review")} disabled={inputsDisabled}>Review <ArrowRight /></Button>
            )}
          </div>
        </footer>
      )}

      {/* small-screen sheets */}
      <Sheet open={navOpen && !isLg} onOpenChange={setNavOpen}>
        <SheetContent side="bottom">
          <SheetTitle className="mb-1 text-base font-semibold">Questions</SheetTitle>
          <SheetDescription className="mb-4 text-sm text-muted-foreground">Jump to any question.</SheetDescription>
          {nav}
          <Button className="mt-5" onClick={() => { setNavOpen(false); setView("review"); }} disabled={inputsDisabled}><Send /> Review &amp; submit</Button>
        </SheetContent>
      </Sheet>
      <Sheet open={toolsOpen && !isLg} onOpenChange={setToolsOpen}>
        <SheetContent side="right">
          <SheetTitle className="sr-only">Tools</SheetTitle>
          <SheetDescription className="sr-only">Scratchpad, display settings and keyboard shortcuts.</SheetDescription>
          <div className="mt-6 flex-1">{tools}</div>
        </SheetContent>
      </Sheet>

      <SubmitDialog open={confirmOpen} onOpenChange={setConfirmOpen} ex={ex} />
    </div>
  );
}

function CountdownContainer({ deadline, now, totalMs, onExpire }: { deadline: string; now: () => number; totalMs: number; onExpire?: () => unknown }) {
  useTick(500);
  const remaining = Date.parse(deadline) - now();
  const fired = React.useRef(false);
  React.useEffect(() => {
    if (remaining <= 0 && onExpire && !fired.current) { fired.current = true; onExpire(); }
  }, [remaining, onExpire]);
  return <ExamTimer remainingMs={remaining} totalMs={totalMs} />;
}

function SubmitDialog({ open, onOpenChange, ex }: { open: boolean; onOpenChange: (o: boolean) => void; ex: ReturnType<typeof useExamEngine> }) {
  const qs = ex.attempt?.questions ?? [];
  const blank = qs.filter((q) => { const v = ex.answers[q.aqId]?.value; return !v || ("text" in v ? !v.text.trim() : !v.optionIds.length); }).length;
  const flagged = qs.filter((q) => ex.answers[q.aqId]?.flagged).length;
  return (
    <Dialog open={open} onOpenChange={(o) => !ex.submitting && onOpenChange(o)}>
      <DialogContent hideClose={ex.submitting}>
        <DialogHeader>
          <DialogTitle>Submit your exam?</DialogTitle>
          <DialogDescription>You won&apos;t be able to change your answers after this.</DialogDescription>
        </DialogHeader>
        <ul className="space-y-2 text-sm">
          {blank > 0 && <li><Alert tone="warning">{blank} question{blank > 1 ? "s are" : " is"} not answered.</Alert></li>}
          {flagged > 0 && <li><Alert tone="info">{flagged} question{flagged > 1 ? "s are" : " is"} marked for review.</Alert></li>}
          {ex.pendingCount > 0 && <li><Alert tone="warning">{ex.pendingCount} answer{ex.pendingCount > 1 ? "s haven't" : " hasn't"} reached the server yet. We&apos;ll try to send {ex.pendingCount > 1 ? "them" : "it"} first.</Alert></li>}
          {blank === 0 && flagged === 0 && ex.pendingCount === 0 && <li><Alert tone="success">All {qs.length} questions answered and saved.</Alert></li>}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={ex.submitting}>Keep working</Button>
          <Button onClick={() => ex.submit()} disabled={ex.submitting}>{ex.submitting ? <Loader2 className="animate-spin" /> : <Send />} Submit now</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
