"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import type { AnswerResponse, AttemptState, CandidateQuestion } from "@/lib/contracts/core";
import type { WorkspacePreferences } from "@/lib/contracts/operations";
import { clearAcknowledged, putDraft, readDrafts, type Change } from "@/hooks/exam-offline";
import { Feedback, Heading, Status } from "./common";
import { message, request, RequestError, useResource } from "./client";
import { isDesktop } from "./device";
import { monitorCamera, stopCamera } from "./camera";

type Props = { attemptId: string; userId: string; name: string; back: string; sandbox?: boolean; allowPaste?: boolean; cameraRequired?: boolean; title?: string };
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
type Signal = "fullscreen_exit" | "visibility_hidden" | "window_blur" | "return" | "paste_blocked" | "copy_blocked" | "cut_blocked"
  | "contextmenu_blocked" | "drop_blocked" | "page_hidden" | "camera_no_face" | "camera_multiple_faces" | "camera_out_of_frame" | "camera_return";

export function AttemptWorkspace({ attemptId, userId, name, back, sandbox, allowPaste, cameraRequired, title }: Props) {
  const heading = sandbox ? `Sandbox · ${title ?? "exam preview"}` : title ?? "Exam";
  const shortId = userId.slice(0, 8).toUpperCase();
  const api = "/api/attempts/" + encodeURIComponent(attemptId);
  const scope = `secureexam:${userId}:${attemptId}`;
  const shell = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const token = useRef("");
  const activeQuestion = useRef<CandidateQuestion | undefined>(undefined);
  const changes = useRef(new Map<string, Change>());
  const sending = useRef<Promise<boolean> | null>(null);
  const retry = useRef(0);
  const backoff = useRef(800);
  const clock = useRef({ server: 0, local: 0 });
  const [attempt, setAttempt] = useState<AttemptState>();
  const [question, setQuestion] = useState<CandidateQuestion>();
  const [answer, setAnswer] = useState<AnswerResponse>(null);
  const [started, setStarted] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(0);
  const [away, setAway] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [superseded, setSuperseded] = useState(false);
  const [asking, setAsking] = useState(false);
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  const prefs = useResource<WorkspacePreferences>("/api/me/prefs");
  const remaining = attempt && now ? Math.max(0, Math.ceil((Date.parse(attempt.deadlineAt) - now) / 1_000)) : 0;
  const inProgress = attempt?.status === "in_progress" && !superseded;
  const blocked = !inProgress || !remaining || Boolean(attempt?.reviewUntil) || away;
  const seconds = String(remaining % 60).padStart(2, "0");
  const expired = Boolean(now) && remaining === 0;
  const liveAttemptId = attempt?.id;

  const apply = useCallback(({ data, serverNow }: { data: AttemptState; serverNow?: string }) => {
    setAttempt((previous) => ({ ...previous, ...data, announcements: data.announcements ?? previous?.announcements }));
    if (serverNow) { clock.current = { server: Date.parse(serverNow), local: performance.now() }; setNow(clock.current.server); }
    if (data.status !== "in_progress") {
      stopCamera();
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    }
  }, []);

  const updateError = useCallback((cause: unknown) => {
    if (cause instanceof RequestError && cause.code === "SESSION_SUPERSEDED") {
      setSuperseded(true);
      setError("Exam continued in another window.");
      return;
    }
    setError(message(cause));
  }, []);

  const loadQuestion = useCallback(async (position?: number) => {
    const { data } = await request<CandidateQuestion>(api + "/questions/" + (position ?? "current"), "GET", undefined, { "x-exam-session-id": token.current });
    activeQuestion.current = data;
    setQuestion(data);
    const queued = changes.current.get(data.id);
    setAnswer(queued && queued.seq > data.seq ? queued.response : data.response);
  }, [api]);

  const flush = useCallback(async function send(): Promise<boolean> {
    if (sending.current) return sending.current;
    const batch = [...changes.current.values()];
    if (!batch.length) return true;
    if (!token.current || !navigator.onLine) return false;
    const flight = (async () => {
      try {
        const { data } = await request<{ saved: Array<{ qid: string; seq: number }> }>(api + "/answers", "PUT", { sessionId: token.current, answers: batch });
        for (const ack of data.saved) {
          if (changes.current.get(ack.qid)?.seq === ack.seq) changes.current.delete(ack.qid);
          if (activeQuestion.current?.id === ack.qid) activeQuestion.current.seq = Math.max(activeQuestion.current.seq, ack.seq);
        }
        setPending(changes.current.size);
        backoff.current = 800;
        await clearAcknowledged(scope, data.saved).catch(() => {});
        if (changes.current.size) {
          window.clearTimeout(retry.current);
          retry.current = window.setTimeout(() => void send(), 800);
        } else { setNotice("All changes saved."); setError(""); }
        return true;
      } catch (cause) {
        if (cause instanceof RequestError) updateError(cause);
        else {
          setNotice("Changes queued on this device.");
          backoff.current = Math.min(backoff.current * 2, 8_000);
          window.clearTimeout(retry.current);
          retry.current = window.setTimeout(() => void send(), backoff.current);
        }
        return false;
      } finally { sending.current = null; }
    })();
    sending.current = flight;
    return flight;
  }, [api, scope, updateError]);

  const heartbeat = useCallback(async (takeover = false) => {
    const result = await request<AttemptState>(api + "/heartbeat", "POST",
      takeover ? { takeover: true, deviceCheck: isDesktop() } : { sessionId: token.current });
    if (result.data.sessionId) {
      token.current = result.data.sessionId;
      sessionStorage.setItem(scope, result.data.sessionId);
    }
    apply(result);
    setError((current) => current === "Exam continued in another window." ? current : "");
    return result.data;
  }, [api, scope, apply]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const drafts = await readDrafts(scope).catch(() => []);
        if (!mounted) return;
        changes.current = new Map(drafts.map((draft) => [draft.qid, draft]));
        setPending(changes.current.size);
        apply(await request<AttemptState>(api));
      } catch (cause) { if (mounted) updateError(cause); }
    })();
    const sync = () => { setOnline(navigator.onLine); if (navigator.onLine && token.current) void flush(); };
    sync();
    window.addEventListener("online", sync); window.addEventListener("offline", sync);
    return () => {
      mounted = false;
      window.clearTimeout(retry.current);
      window.removeEventListener("online", sync); window.removeEventListener("offline", sync);
    };
  }, [api, apply, flush, scope, updateError]);

  useEffect(() => {
    const timer = setInterval(() => { if (clock.current.server) setNow(clock.current.server + performance.now() - clock.current.local); }, 500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!inProgress) return;
    const timer = setInterval(() => {
      if (started && token.current && navigator.onLine) void heartbeat().then(() => flush()).catch(updateError);
    }, 15_000);
    return () => clearInterval(timer);
  }, [inProgress, started, heartbeat, flush, updateError]);

  useEffect(() => {
    if (!liveAttemptId || !inProgress || !expired) return;
    const timer = setInterval(() => {
      if (navigator.onLine) void request<AttemptState>(api).then(apply).catch(updateError);
    }, 3_000);
    return () => clearInterval(timer);
  }, [api, apply, liveAttemptId, inProgress, expired, updateError]);

  function setResponse(value: AnswerResponse) {
    if (!question || question.locked || blocked) return;
    setAnswer(value);
    const previous = changes.current.get(question.id);
    const seq = Math.max(previous?.seq ?? 0, question.seq) + 1;
    const change = { qid: question.id, seq, response: value };
    changes.current.set(question.id, change);
    setPending(changes.current.size);
    void putDraft(scope, change).catch(() => setNotice("Disk storage is unavailable. Keep this tab open until changes are saved."));
    window.clearTimeout(retry.current);
    retry.current = window.setTimeout(() => void flush(), 800);
  }

  const signal = useCallback((type: Signal, extra: { chars?: number; frames?: string[] } = {}) => {
    if (!token.current || !navigator.onLine) return Promise.resolve();
    return request(api + "/events", "POST", { sessionId: token.current, type, qid: activeQuestion.current?.id, ...extra }).then(() => {}).catch((cause) => {
      if (cause instanceof RequestError && cause.code === "SESSION_SUPERSEDED") updateError(cause);
    });
  }, [api, updateError]);

  useEffect(() => {
    if (!started || !inProgress) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reportAway = (kind: "fullscreen_exit" | "visibility_hidden" | "window_blur") => {
      void signal(kind);
      if (attempt?.integrityMode === "standard") return;
      setAway(true);
      timer ??= setTimeout(() => {
        timer = undefined;
        void request<AttemptState>(api + "/violation", "POST", { sessionId: token.current }).then(apply).catch(updateError);
      }, 3_100);
    };
    const returnToExam = () => {
      if (document.hidden || !document.fullscreenElement) return;
      setAway(false);
      void signal("return").then(() => heartbeat()).catch(updateError);
    };
    const fullscreen = () => document.fullscreenElement ? returnToExam() : reportAway("fullscreen_exit");
    const visibility = () => document.hidden ? reportAway("visibility_hidden") : returnToExam();
    const blur = () => reportAway("window_blur");
    const hidden = () => {
      if (token.current) navigator.sendBeacon(api + "/events", new Blob([JSON.stringify({
        sessionId: token.current, type: "page_hidden", qid: activeQuestion.current?.id,
      })], { type: "application/json" }));
    };
    document.addEventListener("fullscreenchange", fullscreen);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("blur", blur); window.addEventListener("focus", returnToExam); window.addEventListener("pagehide", hidden);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("fullscreenchange", fullscreen); document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("blur", blur); window.removeEventListener("focus", returnToExam); window.removeEventListener("pagehide", hidden);
    };
  }, [api, apply, attempt?.integrityMode, heartbeat, inProgress, signal, started, updateError]);

  useEffect(() => {
    if (!started || !inProgress || !cameraRequired || !video.current) return;
    let dispose: (() => void) | undefined;
    let stopped = false;
    void monitorCamera(video.current, (type, frames) => {
      setNotice(type === "camera_return" ? "Thanks, your face is visible again."
        : type === "camera_no_face" ? "No face detected. Stay in view: after 10 minutes away the attempt is voided for review."
        : type === "camera_multiple_faces" ? "More than one person is in view. This is flagged for your examiner." : "Center your face in the camera.");
      void signal(type, frames.length ? { frames } : {});
    }).then((stop) => { if (stopped) stop(); else dispose = stop; }).catch((cause) => setNotice(message(cause)));
    return () => { stopped = true; dispose?.(); };
  }, [cameraRequired, inProgress, signal, started]);

  async function enter() {
    setBusy(true); setError("");
    try {
      if (!isDesktop()) throw new Error("This exam can only be taken on a desktop or laptop computer.");
      // Standard mode only logs signals, so it never requires fullscreen. Review and strict modes do.
      if (attempt?.integrityMode !== "standard" && !document.fullscreenElement) {
        try { await shell.current?.requestFullscreen(); }
        catch {
          throw new Error("Your browser did not allow fullscreen. Select Try again and accept the fullscreen prompt.");
        }
      }
      const stored = sessionStorage.getItem(scope);
      token.current = stored ?? "";
      const data = await heartbeat(true);
      if (data.status === "in_progress" && data.sessionId) {
        for (let second = 3; second > 0; second--) {
          setCountdown(second);
          await new Promise((resolve) => setTimeout(resolve, 1_000));
        }
        setCountdown(0);
        setStarted(true);
        if (!data.reviewUntil) await loadQuestion();
        void flush();
      }
    } catch (cause) { updateError(cause); }
    finally { setBusy(false); }
  }

  async function action(handler: () => Promise<void>, flushFirst = false) {
    if (busy || !token.current) return;
    setBusy(true); setError("");
    try {
      if (flushFirst) {
        if (!(await flush()) || (changes.current.size > 0 && (!(await flush()) || changes.current.size > 0))) {
          throw new Error("Wait until your queued answers have synced.");
        }
      }
      await handler();
    } catch (cause) { updateError(cause); }
    finally { setBusy(false); }
  }

  function go(position: number) {
    void action(async () => {
      if (!attempt || blocked) return;
      if (position === attempt.currentIndex + 1 && !attempt.palette[position - 1]?.seen) {
        apply(await request<AttemptState>(api + "/next", "POST", { sessionId: token.current }));
      }
      await loadQuestion(position);
    });
  }

  function lock() {
    if (!question || blocked) return;
    void action(async () => {
      await request(api + "/answers/" + question.id + "/lock", "POST", { sessionId: token.current });
      await loadQuestion(question.position);
      apply(await request<AttemptState>(api));
    }, true);
  }

  function flag() {
    if (!question || blocked) return;
    void action(async () => {
      await request(api + "/answers/" + question.id + "/flag", "POST", { sessionId: token.current, flagged: !question.flagged });
      await loadQuestion(question.position);
      apply(await request<AttemptState>(api));
    });
  }

  function option(id: string) {
    setResponse(question?.type === "multi" ? (Array.isArray(answer) && answer.includes(id) ? answer.filter((value) => value !== id) : [...Array.isArray(answer) ? answer : [], id]) : id);
  }

  if (attempt && !inProgress) return <section className="panel submitted" aria-live="polite">
    <Heading title={superseded ? "Exam continued elsewhere" : attempt.status === "voided" ? "Attempt voided" : `${heading} submitted`}
      note={superseded ? "Your active session is in another tab or device." : attempt.status === "voided"
        ? "Review the re-attempt status on your candidate dashboard."
        : attempt.result ? "Practice result, marked automatically." : "Results will appear when your examiner publishes them."} />
    {attempt.result && <p className="result-score"><strong>{attempt.result.score} / {attempt.result.totalMarks}</strong> · {attempt.result.percentage}%</p>}
    {!superseded && attempt.status !== "voided" && <dl className="facts">
      {attempt.submittedAt && <div><dt>Submitted</dt><dd>{new Date(attempt.submittedAt).toLocaleString()}</dd></div>}
      <div><dt>Questions answered</dt><dd>{attempt.palette.filter((item) => item.answered).length} of {attempt.totalQuestions}</dd></div>
      <div><dt>Signals for review</dt><dd>{plural(attempt.incidentCount, "incident")}</dd></div></dl>}
    <div className="actions"><Link href={back} className="button primary">Back to my exams</Link>
      {attempt.result && !sandbox && <Link href="/portal/candidate/results" className="button">View result details</Link>}</div>
  </section>;
  const sectionOf = (sectionId: string | null | undefined) => attempt?.sections?.find((item) => item.id === sectionId);
  const currentSection = sectionOf(question?.sectionId);
  const urgency = remaining <= 60 ? "critical" : remaining <= 300 ? "warning" : "normal";

  return <div className="exam-shell" ref={shell} data-theme={prefs.data?.theme} data-font={prefs.data?.fontSize} onKeyDown={(event) => {
    if (blocked || !question || /INPUT|TEXTAREA|SELECT|BUTTON/.test((event.target as HTMLElement).tagName)) return;
    const key = event.key.toLowerCase();
    const index = Number(key) - 1;
    if (["1", "2", "3", "4"].includes(key) && question.options[index]) { event.preventDefault(); option(question.options[index].id); }
    if (key === "n" && attempt && question.position < attempt.totalQuestions) go(question.position + 1);
    if (key === "p" && question.position > 1) go(question.position - 1);
    if (key === "l") lock();
    if (key === "f") flag();
  }}>
    <div className="exam-status" aria-live="polite"><Feedback error={error} note={notice} pending={!attempt && !error} />
      {started && remaining > 0 && remaining <= 300 && <p className="notice">{remaining <= 60 ? "Less than one minute remains." : "Less than five minutes remain."}</p>}
      {started && remaining === 0 && <p className="notice" role="status">Time is up. SecureExam is finalizing your attempt.</p>}</div>
    {!started && attempt && <section className="panel start-screen"><Heading title={heading}
      note={`${plural(attempt.totalQuestions, "question")} · ${Math.ceil(remaining / 60)} minutes left on the server clock`} />
      <ul className="rules">
        {attempt.integrityMode !== "standard" && <li>The exam runs in fullscreen. Leaving it or switching tabs is recorded{attempt.integrityMode === "strict"
          ? " and voids the attempt; an administrator decides on any re-attempt" : " and pauses you for a short explanation"}.</li>}
        {attempt.integrityMode === "standard" && <li>Practice mode: fullscreen is optional and activity is only logged.</li>}
        <li>Answers save automatically, even offline. Your timer keeps running on the server.</li>
        <li>Copy, paste and right-click are blocked inside the exam{allowPaste ? " (paste is allowed for you)" : ""}.</li>
        {attempt.openLimit !== null && <li>You can keep up to {plural(attempt.openLimit, "open question")} before you must lock one to continue.</li>}
      </ul>
      {countdown > 0 ? <p className="countdown" aria-live="assertive">{countdown}</p> : <div className="actions">
        <button className="primary" disabled={busy || !remaining} onClick={() => void enter()}>{busy ? "Opening…" : error ? "Try again"
          : attempt.integrityMode === "standard" ? "Start" : "Enter fullscreen and start"}</button>
        <Link href={back} className="button">Back</Link></div>}</section>}
    {started && attempt && <>
      <div className="exam-watermark" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <span key={i}>{name} · {shortId}</span>)}</div>
      <section className="panel exam-toolbar"><div><h2>{heading}</h2>
        <p className="watermark">{name} · ID {shortId}{currentSection && (attempt.sections?.length ?? 0) > 1 ? ` · ${currentSection.title}` : ""}</p></div>
        <div className="exam-clock"><span className="timer" data-urgency={urgency} aria-label={`${Math.floor(remaining / 60)} minutes and ${seconds} seconds remaining`}>{Math.floor(remaining / 60)}:{seconds}</span>
        <span className="save-chip" data-state={online ? pending ? "saving" : "saved" : "offline"} role="status">{online ? pending ? `Saving · ${pending} queued` : "Saved ✓" : `Offline · ${pending} queued`}</span></div></section>
      {away && <section className="panel"><h2>Return to the exam</h2><p>Return to fullscreen within three seconds to avoid interrupting the attempt.</p>
        <button onClick={() => void shell.current?.requestFullscreen().catch(updateError)}>Return to fullscreen</button></section>}
      {attempt.reviewUntil && <section className="panel"><h2>Integrity review pause</h2>
        <p>Describe what happened. You can continue after the pause.</p><form onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          void action(async () => {
            await request(api + "/explanation", "POST", { sessionId: token.current, explanation: data.get("explanation") });
            await heartbeat();
            await loadQuestion(question?.position);
            setAway(false);
            void flush();
          });
        }}><label>Explanation<textarea name="explanation" required minLength={10} maxLength={2000} /></label>
          <button disabled={busy || now < Date.parse(attempt.reviewUntil)}>Send explanation and continue{now < Date.parse(attempt.reviewUntil) ? ` in ${Math.ceil((Date.parse(attempt.reviewUntil) - now) / 1_000)}s` : ""}</button></form>
      </section>}
      {attempt.announcements?.some((item) => !item.read && !acknowledged.includes(item.id)) && <section className="panel announcement-strip" aria-live="polite">
        {attempt.announcements.filter((item) => !item.read && !acknowledged.includes(item.id)).slice(0, 3).map((item) => <div key={item.id} className="announcement">
          <div><strong>{item.private ? "Message from your examiner" : "Announcement"}</strong><p>{item.message}</p></div>
          <button onClick={() => { setAcknowledged((list) => [...list, item.id]); void request("/api/announcements/" + item.id + "/ack", "POST").catch(updateError); }}>Got it</button>
        </div>)}</section>}
      <div className="layout"><section className="panel" onPaste={(event) => {
        if (!allowPaste) { event.preventDefault(); void signal("paste_blocked", { chars: Math.min(24_000, event.clipboardData.getData("text").length) }); }
      }} onCopy={(event) => { event.preventDefault(); void signal("copy_blocked"); }} onCut={(event) => { event.preventDefault(); void signal("cut_blocked"); }}
      onContextMenu={(event) => { event.preventDefault(); void signal("contextmenu_blocked"); }}
      onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void signal("drop_blocked"); }}>
        {question ? <><div className="section-row"><h2>Question {question.position} of {attempt.totalQuestions}</h2>{question.locked && <Status value="locked" />}</div>
          {currentSection?.instructions && question.position === currentSection.firstPosition && <p className="notice section-note"><strong>{currentSection.title}.</strong> {currentSection.instructions}</p>}
          <div className="exam-split" data-layout={prefs.data?.layout}>
            <div className="stem"><p>{question.text}</p><small>{plural(question.marks, "mark")}</small></div>
            <fieldset disabled={blocked || question.locked}><legend>Your answer</legend>
              {question.type === "written" ? <label>Written response<textarea value={typeof answer === "string" ? answer : ""} onChange={(event) => setResponse(event.target.value)} maxLength={24_000} /></label>
                : <div className="option-list">{question.options.map(({ id, text }, index) => <label className="check answer" key={id}>
                  <input type={question.type === "multi" ? "checkbox" : "radio"} name="choice" checked={Array.isArray(answer) ? answer.includes(id) : answer === id}
                    onChange={() => option(id)} /><span>{index + 1}. {text}</span></label>)}</div>}
            </fieldset>
          </div>
          <div className="actions"><button disabled={busy || blocked || question.position <= 1} onClick={() => go(question.position - 1)}>Previous</button>
            <button disabled={busy || blocked || question.locked} onClick={lock}>Lock answer</button>
            <button disabled={busy || blocked} onClick={flag}>{question.flagged ? "Remove flag" : "Flag for review"}</button>
            <button className="primary" disabled={busy || blocked || question.position >= attempt.totalQuestions} onClick={() => go(question.position + 1)}>Next question</button></div>
        </> : <p className="muted">The current question will appear when the workspace is ready.</p>}
      </section><aside className="panel"><h2>Question navigator</h2><p>{plural(attempt.openCount, "open question")}{attempt.openLimit === null ? "" : ` of ${attempt.openLimit} allowed`}</p>
        {(attempt.sections?.length ? attempt.sections : [{ id: "all", title: "", firstPosition: 1, count: attempt.totalQuestions }]).map((group) => <div key={group.id}>
          {(attempt.sections?.length ?? 0) > 1 && <h3 className="palette-heading">{group.title}</h3>}
          <div className="palette">{attempt.palette.filter((item) => item.position >= group.firstPosition && item.position < group.firstPosition + group.count).map((item) =>
            <button key={item.position} disabled={busy || blocked || !item.seen}
              aria-label={`Question ${item.position}${item.locked ? ", locked" : ""}${item.flagged ? ", flagged" : ""}${!item.seen ? ", not released" : ""}`}
              aria-current={question?.position === item.position} data-answered={item.answered} data-locked={item.locked} data-flagged={item.flagged}
              data-seen={item.seen} onClick={() => go(item.position)}>{item.position}{item.flagged ? "•" : ""}</button>)}</div></div>)}
        <p className="palette-legend"><span data-k="answered">Answered</span><span data-k="locked">Locked</span><span data-k="flagged">Flagged</span><span data-k="unseen">Not released</span></p>
        <p><small>Keyboard shortcuts: 1–4 answer, N/P navigate, L lock, F flag.</small></p>
        {!sandbox && (attempt.handRaisedAt ? <div className="ask"><p className="notice">Your examiner has been asked. Keep working; the reply appears above.</p>
          <button disabled={busy} onClick={() => void action(async () => {
            await request(api + "/hand", "POST", { sessionId: token.current, raised: false });
            setAttempt((previous) => previous && { ...previous, handRaisedAt: null });
          })}>Lower hand</button></div>
          : asking ? <form className="ask" onSubmit={(event) => {
            event.preventDefault();
            const note = String(new FormData(event.currentTarget).get("note") ?? "");
            void action(async () => {
              const { data } = await request<{ handRaisedAt: string }>(api + "/hand", "POST", { sessionId: token.current, raised: true, message: note || undefined });
              setAttempt((previous) => previous && { ...previous, handRaisedAt: data.handRaisedAt });
              setAsking(false);
            });
          }}><label>Question for the examiner (optional)<input name="note" maxLength={300} placeholder="e.g. Question 4 seems to have two answers" /></label>
            <div className="actions"><button type="button" onClick={() => setAsking(false)}>Cancel</button><button className="primary" disabled={busy}>Ask</button></div></form>
          : <button disabled={busy || blocked} onClick={() => setAsking(true)}>Ask examiner</button>)}
        <button className="primary" disabled={busy || blocked} onClick={() => void action(async () => {
          apply(await request<AttemptState>(api)); setConfirm(true);
        }, true)}>Review and submit</button>
        {confirm && <div role="group" aria-label="Submission summary"><p>{attempt.palette.filter((item) => !item.answered).length} unanswered · {attempt.openCount} open · {attempt.palette.filter((item) => item.flagged).length} flagged</p>
          <div className="palette">{attempt.palette.filter((item) => item.seen && (!item.answered || !item.locked || item.flagged)).map((item) =>
            <button key={item.position} onClick={() => { setConfirm(false); go(item.position); }} aria-label={`Go to question ${item.position}`}>{item.position}</button>)}</div>
          <div className="actions"><button onClick={() => setConfirm(false)}>Keep working</button>
            <button className="primary" disabled={busy || blocked} onClick={() => void action(async () => {
              apply(await request<AttemptState>(api + "/submit", "POST", { sessionId: token.current }));
              sessionStorage.removeItem(scope); setConfirm(false);
            }, true)}>Submit attempt</button></div></div>}
      </aside></div>
      <Scratchpad scope={scope} />
      {cameraRequired && <video ref={video} width={160} height={120} muted playsInline aria-label="Camera preview for your exam" />}
    </>}
  </div>;
}

function Scratchpad({ scope }: { scope: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [notes, setNotes] = useState("");
  const [erase, setErase] = useState(false);
  const [usable, setUsable] = useState(true);
  useEffect(() => {
    // localStorage exists only in the browser, so it is read after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { setNotes(localStorage.getItem(scope + ":notes") ?? ""); }
    catch { setUsable(false); }
  }, [scope]);
  function draw(event: PointerEvent<HTMLCanvasElement>, begin: boolean) {
    const element = event.currentTarget;
    if (begin) element.setPointerCapture(event.pointerId);
    else if (!element.hasPointerCapture(event.pointerId)) return;
    const ctx = element.getContext("2d");
    if (!ctx) return;
    const box = element.getBoundingClientRect();
    const x = (event.clientX - box.left) * element.width / box.width;
    const y = (event.clientY - box.top) * element.height / box.height;
    ctx.globalCompositeOperation = erase ? "destination-out" : "source-over";
    ctx.lineWidth = erase ? 18 : 2; ctx.lineCap = "round";
    if (begin) { ctx.beginPath(); ctx.moveTo(x, y); }
    else { ctx.lineTo(x, y); ctx.stroke(); }
  }
  return <details className="panel"><summary>Scratchpad</summary>
    <div className="actions"><button aria-pressed={!erase} onClick={() => setErase(false)}>Pen</button><button aria-pressed={erase} onClick={() => setErase(true)}>Eraser</button>
      <button onClick={() => canvas.current?.getContext("2d")?.clearRect(0, 0, 800, 240)}>Clear drawing</button></div>
    <canvas ref={canvas} className="scratchpad" width={800} height={240} onPointerDown={(event) => draw(event, true)} onPointerMove={(event) => draw(event, false)} aria-label="Scratch drawing area" />
    <label>Personal notes<textarea value={notes} onChange={(event) => {
      setNotes(event.target.value);
      if (usable) try { localStorage.setItem(scope + ":notes", event.target.value); } catch { setUsable(false); }
    }} /></label>
  </details>;
}
