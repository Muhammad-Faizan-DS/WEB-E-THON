"use client";
import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, CheckCircle2, ClipboardX, Clock3, EyeOff, Hourglass, Loader2, Maximize, MonitorSmartphone, ShieldCheck, Wifi, WifiOff, XCircle,
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
import { Input, Label } from "@/components/ui/input";
import { USE_MOCKS } from "@/lib/client/api";
import { StatStrip } from "@/components/ui/card";
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
  // one-time identity check: password + student ID, before the first start
  const [verifiedAt, setVerifiedAt] = React.useState<string | null>(null);
  const [idForm, setIdForm] = React.useState({ studentId: "", password: "" });
  const [idError, setIdError] = React.useState<string | null>(null);
  const [verifying, setVerifying] = React.useState(false);
  async function verifyIdentity(e: React.FormEvent) {
    e.preventDefault();
    if (!idForm.studentId.trim() || !idForm.password) { setIdError("Enter your student ID and password."); return; }
    setIdError(null); setVerifying(true);
    try {
      const r = await api.post<{ verifiedAt: string }>(`/api/exams/${examId}/verify-identity`, idForm);
      setVerifiedAt(r.verifiedAt); setIdForm({ studentId: "", password: "" });
    } catch (err) { setIdError(err instanceof ApiError ? err.message : "Couldn't verify. Try again."); }
    finally { setVerifying(false); }
  }
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
    <div className="mx-auto max-w-5xl">
      <Link href="/candidate" className="mb-6 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> My exams</Link>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b pb-6">
        <div>
          <p className="text-[13px] text-muted-foreground"><span className="font-mono">{entry.code}</span> · {entry.examinerName}</p>
          <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-[-0.015em]">{entry.title}</h1>
          <p className="num mt-1.5 text-[13px] text-muted-foreground">Open {fmtDateTime(entry.opensAt)} – {fmtDateTime(entry.closesAt)} (PKT)</p>
        </div>
        <CandidateStatusBadge status={entry.status} />
      </header>

      {entry.status === "locked" && entry.attemptId && <LockedPanel attemptId={entry.attemptId} />}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0 space-y-10">
          <StatStrip items={[
            { label: "Time allowed", value: `${entry.durationMin} min`, hint: entry.phase === "ongoing" && effectiveMin < entry.durationMin ? `${effectiveMin} min before it closes` : undefined },
            { label: "Questions", value: entry.questionCount, hint: [entry.typeCounts.single && `${entry.typeCounts.single} single`, entry.typeCounts.multi && `${entry.typeCounts.multi} multi`, entry.typeCounts.written && `${entry.typeCounts.written} written`].filter(Boolean).join(" · ") },
            { label: "Total marks", value: entry.totalMarks },
            { label: "Tabs or devices", value: `${entry.opensUsed} of ${s.maxOpens}`, hint: "Refreshing doesn't count" },
          ]} />

          <section aria-labelledby="ins">
            <h2 id="ins" className="mb-3 text-base font-semibold">Instructions</h2>
            <div className="prose-read max-w-[68ch] whitespace-pre-line text-foreground/90">{entry.instructions}</div>
          </section>

          <section aria-labelledby="rules">
            <h2 id="rules" className="mb-3 text-base font-semibold">Rules for this exam</h2>
            <ul className="max-w-[68ch] divide-y border-y text-sm">
              <Rule icon={Clock3}>The timer is kept by the server. It keeps running if you close the tab, and refreshing never changes it.</Rule>
              <Rule icon={CheckCircle2}>{entry.multiSelectRule === "partial" ? "Multiple-select questions give partial marks: each correct choice adds, each wrong choice subtracts, never below zero." : "Multiple-select questions are marked by exact match: select every correct option and no wrong ones."}</Rule>
              {s.pastePolicy === "block" && <Rule icon={ClipboardX}>Pasting into answers is turned off. Paste attempts are noted by length only, never the text.</Rule>}
              {s.pastePolicy === "log" && <Rule icon={ClipboardX}>You may paste. Pastes are noted by length only, never the text.</Rule>}
              {s.fullscreenRequired && <Rule icon={Maximize}>The exam runs in fullscreen. If you leave it, questions are hidden until you return; the timer keeps running.</Rule>}
              <Rule icon={EyeOff}>Questions are only shown while this exam is the window in front. Switch to another app, tab or window and they are hidden until you come back. Copying question text is turned off.</Rule>
              <Rule icon={ShieldCheck}>Before you start, you confirm your identity once with your student ID and password. The attempt is then tied to you.</Rule>
              <Rule icon={WifiOff}>If your internet drops, keep working. Answers stay on this device and are sent when you reconnect. Only answers that reach the server before the deadline count.</Rule>
              <Rule icon={MonitorSmartphone}>You can open this exam in up to {s.maxOpens} tabs or devices. After that it locks until your examiner unlocks it.</Rule>
            </ul>
          </section>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-lg border bg-surface">
            <section aria-labelledby="obs" className="p-5">
              <h2 id="obs" className="flex items-center gap-2 text-[15px] font-semibold"><ShieldCheck className="size-4 text-primary" aria-hidden />What we observe</h2>
              <ul className="mt-3 space-y-2 text-[13px]">
                <li className="flex gap-2"><EyeOff className="mt-0.5 size-4 shrink-0 text-subtle-foreground" aria-hidden />Leaving this tab or window, and for how long</li>
                {s.fullscreenRequired && <li className="flex gap-2"><Maximize className="mt-0.5 size-4 shrink-0 text-subtle-foreground" aria-hidden />Leaving fullscreen</li>}
                <li className="flex gap-2"><ClipboardX className="mt-0.5 size-4 shrink-0 text-subtle-foreground" aria-hidden />Paste attempts (length only)</li>
                <li className="flex gap-2"><Wifi className="mt-0.5 size-4 shrink-0 text-subtle-foreground" aria-hidden />Connection drops</li>
              </ul>
              <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">Never recorded:</span> camera, microphone, screen, keystrokes, clipboard text or other websites. A person reviews observations; they never change marks on their own.
              </p>
            </section>
            <section aria-labelledby="dev" className="border-t p-5">
              <h2 id="dev" className="text-[15px] font-semibold">This device</h2>
              <ul className="mt-3 space-y-2">
                <Check ok={device.online} label={device.online ? "Connected to the internet" : "You're offline"} />
                {s.fullscreenRequired && <Check ok={!fsBlocked} label={fsBlocked ? "This browser can't go fullscreen" : "Fullscreen available"} />}
                <Check ok={!mobileBlocked} label={mobileBlocked ? "Use a laptop or desktop for this exam" : device.mobile ? "Phone or tablet allowed" : "Laptop or desktop"} />
              </ul>
            </section>
            <section id="start-panel" className="scroll-mt-24 space-y-4 border-t p-5">
              {entry.phase === "scheduled" && <p className="text-sm"><span className="font-medium">Not open yet.</span> Opens {fmtRelative(Date.parse(entry.opensAt) - now)}; this page updates by itself.</p>}
              {entry.phase === "completed" && <p className="text-sm font-medium">This exam has closed.</p>}
              {resuming && left !== null && (
                <p className="flex items-center justify-between text-sm"><span className="flex items-center gap-2"><Hourglass className="size-4 text-primary" aria-hidden />Time left</span><span className="num font-mono text-base font-semibold">{fmtClock(left)}</span></p>
              )}
              {canStart && !resuming && (
                <label className="flex cursor-pointer gap-3 text-[13px] leading-snug">
                  <Checkbox id="start-consent" checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
                  <span>I&apos;ve read the instructions and understand what is observed during this exam.</span>
                </label>
              )}
              {startError && <Alert tone="danger">{startError}</Alert>}
              {canStart && !resuming && (
                <form onSubmit={verifyIdentity} className="space-y-3 rounded-lg border bg-surface-2/60 p-3.5" aria-labelledby="idv-title">
                  <h3 id="idv-title" className="flex items-center gap-2 text-[14px] font-semibold"><ShieldCheck className="size-4 text-primary" aria-hidden />{verifiedAt ? "Identity verified" : "Verify it's you"}</h3>
                  {verifiedAt ? (
                    <p className="flex items-center gap-1.5 text-[13px]"><CheckCircle2 className="size-4 text-success" aria-hidden />Confirmed at <span className="num">{new Date(verifiedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>. This attempt is now tied to you and this device.</p>
                  ) : (
                    <>
                      <p className="text-[12px] text-muted-foreground">Once per exam, so no one else can sit it for you.</p>
                      <div className="space-y-1"><Label htmlFor="idv-sid">Student ID</Label><Input id="idv-sid" autoComplete="off" value={idForm.studentId} onChange={(e) => setIdForm((f) => ({ ...f, studentId: e.target.value }))} placeholder="FA23-BCS-001" className="font-mono" /></div>
                      <div className="space-y-1"><Label htmlFor="idv-pw">Password</Label><Input id="idv-pw" type="password" autoComplete="current-password" value={idForm.password} onChange={(e) => setIdForm((f) => ({ ...f, password: e.target.value }))} /></div>
                      {idError && <p role="alert" className="text-[13px] text-danger">{idError}</p>}
                      <Button type="submit" variant="outline" className="w-full" disabled={verifying}>{verifying && <Loader2 className="animate-spin" />} Verify identity</Button>
                      {USE_MOCKS && <p className="text-[11px] text-muted-foreground">Demo IDs: Ali FA23-BCS-001 · Sara FA23-BCS-002 · Omar FA23-BCS-003 · password Demo@2026</p>}
                    </>
                  )}
                </form>
              )}
              <Button size="lg" className="w-full" disabled={!canStart || (!resuming && (!consent || !verifiedAt)) || starting || !device.online} onClick={start}>
                {starting && <Loader2 className="animate-spin" />}
                {resuming ? "Resume exam" : entry.status === "reattempt_granted" ? "Start re-attempt" : "Start exam"}
                {!starting && <ArrowRight />}
              </Button>
              {!resuming && canStart && <p className="num text-center text-xs text-muted-foreground">Your {effectiveMin}-minute timer starts when you press Start.</p>}
            </section>
          </div>
        </aside>
      </div>

      {/* phones: the start panel sits below the rules, so keep a way to reach it on screen */}
      {(canStart || resuming) && (
        <div className="sticky bottom-0 z-20 -mx-4 mt-8 flex items-center justify-between gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
          <p className="num text-[13px]">
            {resuming && left !== null ? <><span className="font-semibold">{fmtClock(left)}</span> left</> : <><span className="font-semibold">{effectiveMin} min</span> once you start</>}
          </p>
          {resuming ? (
            <Button onClick={start} disabled={starting || !device.online}>{starting && <Loader2 className="animate-spin" />} Resume exam <ArrowRight /></Button>
          ) : (
            <Button onClick={() => { document.getElementById("start-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }); setTimeout(() => document.getElementById("start-consent")?.focus(), 400); }}>
              Ready to start <ArrowRight />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function Rule({ icon: Icon, children }: { icon: typeof Clock3; children: React.ReactNode }) {
  return <li className="flex gap-3 py-3"><Icon className="mt-0.5 size-4 shrink-0 text-subtle-foreground" aria-hidden /><span>{children}</span></li>;
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={`flex items-center gap-2 text-[13px] ${ok ? "" : "font-medium text-danger"}`}>
      {ok ? <CheckCircle2 className="size-4 text-success" aria-hidden /> : <XCircle className="size-4 text-danger" aria-hidden />}
      {label}<span className="sr-only">{ok ? " (ok)" : " (problem)"}</span>
    </li>
  );
}

function LockedPanel({ attemptId }: { attemptId: string }) {
  const [sent, setSent] = React.useState(false);
  return (
    <Alert tone="warning" title="Your attempt is locked" className="mb-8">
      <p>This exam was opened in more tabs or devices than allowed. Your saved answers are safe, but <b>the timer is still running</b>. Ask your examiner to unlock it.</p>
      <div className="mt-4">{sent ? <p className="font-medium">Request sent. This page updates when your examiner decides.</p> : <RequestForm attemptId={attemptId} type="unlock" onSent={() => setSent(true)} />}</div>
    </Alert>
  );
}
