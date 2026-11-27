"use client";
import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, CheckCircle2, ClipboardX, Clock3, EyeOff, Hourglass, Laptop, Loader2, Lock, Maximize, MonitorSmartphone, ShieldCheck, Wifi, WifiOff, XCircle,
} from "lucide-react";
import { AttemptState, CandidateExamEntry } from "@/contracts";
import { api, ApiError } from "@/lib/client/api";
import { attemptSessionKey, enterFullscreen, examSessionKey, getOrCreateSession } from "@/lib/client/exam-session";
import { useServerClock, useTick } from "@/lib/client/use-server-clock";
import { useFullscreenSupported, useOnline } from "@/lib/client/use-browser";
import { useMedia } from "@/lib/client/use-media";
import { CandidateStatusBadge } from "@/components/common/status";
import { RequestForm } from "@/components/exam/request-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Checkbox, Skeleton } from "@/components/ui/misc";
import { fmtClock, fmtDateTime, fmtRelative } from "@/lib/utils";

export default function ExamEntryPage() {
  const { examId } = useParams<{ examId: string }>();
  const router = useRouter();
  const clock = useServerClock();
  const [entry, setEntry] = React.useState<CandidateExamEntry | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [consent, setConsent] = React.useState(false);
  const [starting, setStarting] = React.useState(false);
  const [startError, setStartError] = React.useState<string | null>(null);
  const online = useOnline();
  const fullscreen = useFullscreenSupported();
  const mobile = useMedia("(pointer: coarse) and (max-width: 767px)");
  const device = { online, fullscreen, mobile };
  useTick(1000);

  const load = React.useCallback(async () => {
    const sent = Date.now();
    try {
      const e = await api.get(`/api/me/exams/${examId}`, CandidateExamEntry);
      clock.sync(e.serverNow, sent);
      setEntry(e);
    } catch (err) {
      setLoadError(err instanceof ApiError && err.status === 404 ? "This exam doesn't exist or you aren't enrolled in it." : "Couldn't load this exam.");
    }
  }, [examId, clock]);

  React.useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  if (loadError) return <Alert tone="danger" title="Exam unavailable">{loadError} <Link className="underline" href="/candidate">Back to my exams</Link></Alert>;
  if (!entry) return <div className="space-y-4"><Skeleton className="h-10 w-80" /><Skeleton className="h-64" /></div>;

  const now = clock.now();
  const s = entry.settings;
  const resuming = entry.status === "in_progress";
  const mobileBlocked = !s.allowMobile && device.mobile;
  const fsBlocked = s.fullscreenRequired && !device.fullscreen;
  const canStart = entry.phase === "ongoing" && ["not_started", "in_progress", "reattempt_granted"].includes(entry.status) && !mobileBlocked;
  const left = entry.deadline ? Date.parse(entry.deadline) - now : null;
  const effectiveMin = Math.min(entry.durationMin, Math.max(0, Math.floor((Date.parse(entry.closesAt) - now) / 60000)));

  async function start() {
    setStartError(null);
    setStarting(true);
    if (s.fullscreenRequired) await enterFullscreen(); // must run inside the click gesture
    const sid = getOrCreateSession(examSessionKey(examId));
    try {
      const a = await api.post(`/api/exams/${examId}/attempts`, { clientSessionId: sid }, AttemptState);
      sessionStorage.setItem(attemptSessionKey(a.attemptId), sid);
      router.push(`/exam/${a.attemptId}`);
    } catch (err) {
      setStarting(false);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      setStartError(err instanceof ApiError ? (err.isNetwork ? "You're offline. Connect to the internet to start." : err.message) : "Couldn't start the exam.");
      load();
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/candidate" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> My exams</Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground"><span className="font-mono">{entry.code}</span> · {entry.examinerName}</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{entry.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Open {fmtDateTime(entry.opensAt)} – {fmtDateTime(entry.closesAt)} (PKT)</p>
        </div>
        <CandidateStatusBadge status={entry.status} />
      </div>

      <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Fact label="Time allowed" value={`${entry.durationMin} min`} hint={entry.phase === "ongoing" && effectiveMin < entry.durationMin ? `Only ${effectiveMin} min left before the exam closes` : undefined} />
        <Fact label="Total marks" value={String(entry.totalMarks)} />
        <Fact label="Questions" value={String(entry.questionCount)} hint={[entry.typeCounts.single && `${entry.typeCounts.single} single`, entry.typeCounts.multi && `${entry.typeCounts.multi} multi`, entry.typeCounts.written && `${entry.typeCounts.written} written`].filter(Boolean).join(" · ")} />
        <Fact label="Opens allowed" value={`${entry.opensUsed} of ${s.maxOpens} used`} hint="Tabs or devices. Refreshing doesn't count." />
      </dl>

      {entry.status === "locked" && entry.attemptId && <LockedPanel attemptId={entry.attemptId} />}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Instructions</CardTitle></CardHeader>
            <CardContent className="space-y-3 whitespace-pre-line text-[0.95rem] leading-relaxed">{entry.instructions}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Rules for this exam</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm">
                <Rule icon={Clock3}>The timer is kept by the server. It keeps running if you close the tab, and refreshing never changes it.</Rule>
                <Rule icon={CheckCircle2}>{entry.multiSelectRule === "partial" ? "Multiple-select questions give partial marks: each correct choice adds, each wrong choice subtracts (never below zero)." : "Multiple-select questions are marked by exact match: select every correct option and no wrong ones."}</Rule>
                {s.pastePolicy === "block" && <Rule icon={ClipboardX}>Pasting into answers is turned off. Paste attempts are recorded (length only, never the text).</Rule>}
                {s.pastePolicy === "log" && <Rule icon={ClipboardX}>You may paste, but pastes are recorded (length only, never the text).</Rule>}
                {s.fullscreenRequired && <Rule icon={Maximize}>The exam runs in fullscreen. If you leave fullscreen, questions are hidden until you return. Your time keeps running.</Rule>}
                <Rule icon={WifiOff}>If your internet drops, keep working. Answers are kept on this device and sent when you reconnect. Only answers that reach the server before the deadline count.</Rule>
                <Rule icon={MonitorSmartphone}>You can open this exam in up to {s.maxOpens} tabs or devices. After that it locks and your examiner must unlock it.</Rule>
              </ul>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:self-start lg:overflow-y-auto">
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary" aria-hidden />What we observe</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <ul className="space-y-1.5">
                <li className="flex gap-2"><EyeOff className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />Leaving this tab or window, and for how long</li>
                {s.fullscreenRequired && <li className="flex gap-2"><Maximize className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />Leaving fullscreen</li>}
                <li className="flex gap-2"><ClipboardX className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />Paste attempts (character count only)</li>
                <li className="flex gap-2"><Wifi className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />Connection drops</li>
              </ul>
              <p className="rounded-md bg-surface-2 p-2.5 text-xs leading-relaxed text-muted-foreground">
                <b className="text-foreground">Never recorded:</b> camera, microphone, screen, keystrokes, clipboard text or other websites. Observations are reviewed by a person and never change your marks automatically.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Device check</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <Check ok={device.online} label={device.online ? "Connected to the internet" : "You're offline"} />
                {s.fullscreenRequired && <Check ok={!fsBlocked} label={fsBlocked ? "This browser can't go fullscreen" : "Fullscreen available"} />}
                <Check ok={!mobileBlocked} label={mobileBlocked ? "Use a laptop or desktop for this exam" : device.mobile ? "Phone or tablet allowed" : "Laptop or desktop"} icon={Laptop} />
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 pt-5">
              {entry.phase === "scheduled" && <Alert tone="info" title="Not open yet">Opens {fmtRelative(Date.parse(entry.opensAt) - now)}. This page updates when it opens.</Alert>}
              {entry.phase === "completed" && <Alert tone="warning" title="This exam has closed" />}
              {resuming && left !== null && (
                <p className="flex items-center gap-2 text-sm"><Hourglass className="size-4 text-primary" aria-hidden />Time left: <span className="font-mono font-semibold">{fmtClock(left)}</span></p>
              )}
              {canStart && !resuming && (
                <label className="flex cursor-pointer gap-3 text-sm leading-snug">
                  <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} aria-describedby="consent-help" className="mt-0.5" />
                  <span id="consent-help">I have read the instructions and understand what is observed during this exam.</span>
                </label>
              )}
              {startError && <Alert tone="danger">{startError}</Alert>}
              <Button size="lg" className="w-full" disabled={!canStart || (!resuming && !consent) || starting || !device.online} onClick={start}>
                {starting ? <Loader2 className="animate-spin" /> : resuming ? <ArrowRight /> : <Lock className="hidden" />}
                {resuming ? "Resume exam" : entry.status === "reattempt_granted" ? "Start re-attempt" : "Start exam"}
                {!resuming && !starting && <ArrowRight />}
              </Button>
              {!resuming && canStart && <p className="text-center text-xs text-muted-foreground">Your {effectiveMin}-minute timer starts when you press Start.</p>}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-surface p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums">{value}</dd>
      {hint && <dd className="mt-0.5 text-xs text-muted-foreground">{hint}</dd>}
    </div>
  );
}

function Rule({ icon: Icon, children }: { icon: typeof Clock3; children: React.ReactNode }) {
  return <li className="flex gap-3"><Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /><span>{children}</span></li>;
}

function Check({ ok, label, icon }: { ok: boolean; label: string; icon?: typeof Clock3 }) {
  const Icon = icon && ok ? icon : ok ? CheckCircle2 : XCircle;
  return <li className={`flex items-center gap-2 ${ok ? "" : "font-medium text-danger"}`}><Icon className={`size-4 ${ok ? "text-success" : "text-danger"}`} aria-hidden />{label}<span className="sr-only">{ok ? " (passed)" : " (problem)"}</span></li>;
}

function LockedPanel({ attemptId }: { attemptId: string }) {
  const [sent, setSent] = React.useState(false);
  return (
    <Alert tone="warning" title="Your attempt is locked" className="mb-6">
      <p>This exam was opened in more tabs or devices than allowed. Your saved answers are safe, but <b>the timer is still running</b>. Ask your examiner to unlock it.</p>
      <div className="mt-4">{sent ? <p className="font-medium">Request sent. This page updates when your examiner decides.</p> : <RequestForm attemptId={attemptId} type="unlock" onSent={() => setSent(true)} />}</div>
    </Alert>
  );
}
