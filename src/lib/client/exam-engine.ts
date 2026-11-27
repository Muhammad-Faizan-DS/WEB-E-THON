"use client";
/**
 * Exam engine: everything the workspace needs that isn't layout.
 *  - loads/resumes the attempt and registers this tab as an "open" (BR-12)
 *  - keeps a local, revisioned answer queue in IndexedDB (BR-09, PRD §6.1)
 *  - shows "Saved" only when the server acks the latest local revision
 *  - retries with backoff, flushes on reconnect, tracks connection state
 *  - heartbeat (server clock, status, announcements, request decisions)
 *  - batches integrity observations (never content)
 *  - single submit path used by the button and by expiry
 */
import * as React from "react";
import { del, get, set } from "idb-keyval";
import { toast } from "sonner";
import {
  AttemptState, HeartbeatResponse, SaveAnswerAck, SubmissionReceipt,
  type Announcement, type AnswerValue, type IntegrityEventIn, type IntegrityEventType, type PendingRequest,
} from "@/contracts";
import { api, ApiError, USE_MOCKS } from "./api";
import { attemptSessionKey, examSessionKey, getOrCreateSession } from "./exam-session";
import { useServerClock } from "./use-server-clock";
import { useOnline } from "./use-browser";

export type SyncState = "synced" | "pending" | "saving" | "rejected";
export type Connection = "online" | "offline" | "unreachable";

export interface LocalAnswer {
  value: AnswerValue | null;
  rev: number; // latest local revision
  ackRev: number; // latest revision the server confirmed
  flagged: boolean;
  savedAt: string | null;
  sync: SyncState;
}

interface PendingEntry { value: AnswerValue | null; rev: number; opId: string }

const BACKOFF = [1000, 2000, 4000, 8000, 15000];
const HEARTBEAT_MS = 15000;
const EVENTS_MS = 10000;

export function isAnswered(v: AnswerValue | null | undefined) {
  if (!v) return false;
  return "text" in v ? v.text.trim().length > 0 : v.optionIds.length > 0;
}

export const receiptKey = (attemptId: string) => `fm:receipt:${attemptId}`;
export interface StoredReceipt { receipt: SubmissionReceipt; notAccepted: number[] }

export function useExamEngine(attemptId: string, userId: string) {
  const clock = useServerClock();
  const [phase, setPhase] = React.useState<"loading" | "ready" | "error" | "finalized">("loading");
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [attempt, setAttempt] = React.useState<AttemptState | null>(null);
  const [answers, setAnswers] = React.useState<Record<string, LocalAnswer>>({});
  const online = useOnline();
  const [unreachable, setUnreachable] = React.useState(false);
  const connection: Connection = !online ? "offline" : unreachable ? "unreachable" : "online";
  const [deadline, setDeadline] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<AttemptState["status"]>("in_progress");
  const [activeSession, setActiveSession] = React.useState(true);
  const [announcements, setAnnouncements] = React.useState<Announcement[]>([]);
  const [pendingRequest, setPendingRequest] = React.useState<PendingRequest>(null);
  const [lastAckAt, setLastAckAt] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const sid = React.useRef<string>("");
  const examId = React.useRef<string>("");
  const pending = React.useRef<Record<string, PendingEntry>>({});
  const inflight = React.useRef<Record<string, boolean>>({});
  const debounce = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const retryTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryStep = React.useRef(0);
  const events = React.useRef<IntegrityEventIn[]>([]);
  const seq = React.useRef(0);
  const finalizing = React.useRef(false);
  const seenAnnouncements = React.useRef<Set<string>>(new Set());
  const flushRef = React.useRef<(aqId: string) => void>(() => {});
  const answersRef = React.useRef(answers);
  const attemptRef = React.useRef(attempt);
  React.useEffect(() => { answersRef.current = answers; }, [answers]);
  React.useEffect(() => { attemptRef.current = attempt; }, [attempt]);

  const pendingKey = `fm:${userId}:${attemptId}:pending`;
  const persistPending = React.useCallback(() => {
    const p = pending.current;
    (Object.keys(p).length ? set(pendingKey, p) : del(pendingKey)).catch(() => {});
  }, [pendingKey]);

  const patch = React.useCallback((aqId: string, p: Partial<LocalAnswer>) => {
    setAnswers((s) => (s[aqId] ? { ...s, [aqId]: { ...s[aqId], ...p } } : s));
  }, []);

  const markReachable = React.useCallback(() => { setUnreachable(false); retryStep.current = 0; }, []);
  const markUnreachable = React.useCallback(() => { if (navigator.onLine) setUnreachable(true); }, []);

  const absorbAnnouncements = React.useCallback((list: Announcement[], notify: boolean) => {
    const fresh = list.filter((a) => !seenAnnouncements.current.has(a.id));
    fresh.forEach((a) => seenAnnouncements.current.add(a.id));
    if (fresh.length) {
      setAnnouncements(list);
      if (notify) fresh.forEach((a) => toast.info("Announcement from your examiner", { description: a.body, duration: 12000 }));
    }
  }, []);

  // ---------- sending ----------
  const scheduleRetry = React.useCallback(() => {
    if (retryTimer.current) return;
    const ms = BACKOFF[Math.min(retryStep.current, BACKOFF.length - 1)];
    retryStep.current++;
    retryTimer.current = setTimeout(() => {
      retryTimer.current = null;
      Object.keys(pending.current).forEach((id) => flushRef.current(id));
    }, ms);
  }, []);

  const flush = React.useCallback(async (aqId: string) => {
    const p = pending.current[aqId];
    if (!p || inflight.current[aqId] || !sid.current) return;
    inflight.current[aqId] = true;
    let again = false;
    patch(aqId, { sync: "saving" });
    try {
      const ack = await api.put(`/api/attempts/${attemptId}/answers/${aqId}`, { value: p.value, revision: p.rev, clientOpId: p.opId, clientSessionId: sid.current }, SaveAnswerAck);
      markReachable();
      setLastAckAt(ack.savedAt);
      const latest = pending.current[aqId];
      if (latest && ack.revision >= latest.rev) {
        delete pending.current[aqId];
        persistPending();
        patch(aqId, { ackRev: ack.revision, savedAt: ack.savedAt, sync: "synced" });
      } else {
        patch(aqId, { ackRev: ack.revision, savedAt: ack.savedAt, sync: "pending" });
        again = true; // a newer edit arrived while saving
      }
    } catch (e) {
      const err = e as ApiError;
      if (err.isNetwork) {
        markUnreachable();
        patch(aqId, { sync: "pending" });
        scheduleRetry();
      } else if (err.code === "STALE_REVISION") {
        const d = (err.details ?? {}) as { revision?: number; value?: AnswerValue | null };
        delete pending.current[aqId];
        persistPending();
        setAnswers((s) => ({ ...s, [aqId]: { ...s[aqId], value: d.value ?? s[aqId].value, rev: d.revision ?? s[aqId].rev, ackRev: d.revision ?? s[aqId].ackRev, sync: "synced" } }));
        toast.warning("A newer version of this answer was saved from another window", { description: "We kept the newer version." });
      } else if (err.code === "SESSION_SUPERSEDED") {
        setActiveSession(false);
        patch(aqId, { sync: "pending" });
      } else if (err.code === "ATTEMPT_LOCKED") {
        setStatus("locked");
        patch(aqId, { sync: "pending" });
      } else {
        patch(aqId, { sync: "rejected" });
        if (err.code !== "ATTEMPT_CLOSED") toast.error("This answer couldn't be saved", { description: err.message });
      }
    } finally {
      inflight.current[aqId] = false;
    }
    if (again) flushRef.current(aqId);
  }, [attemptId, markReachable, markUnreachable, patch, persistPending, scheduleRetry]);
  React.useEffect(() => { flushRef.current = flush; }, [flush]);

  const flushAll = React.useCallback(() => {
    if (retryTimer.current) { clearTimeout(retryTimer.current); retryTimer.current = null; }
    Object.keys(pending.current).forEach((id) => flushRef.current(id));
  }, []);

  // ---------- public actions ----------
  const setAnswer = React.useCallback((aqId: string, value: AnswerValue | null, debounceMs = 800) => {
    setAnswers((s) => {
      const cur = s[aqId];
      if (!cur) return s;
      const rev = Math.max(cur.rev, cur.ackRev) + 1;
      pending.current[aqId] = { value, rev, opId: crypto.randomUUID() };
      persistPending();
      return { ...s, [aqId]: { ...cur, value, rev, sync: "pending" } };
    });
    clearTimeout(debounce.current[aqId]);
    debounce.current[aqId] = setTimeout(() => flushRef.current(aqId), debounceMs);
  }, [persistPending]);

  const toggleFlag = React.useCallback(async (aqId: string) => {
    const next = !answersRef.current[aqId]?.flagged;
    setAnswers((s) => ({ ...s, [aqId]: { ...s[aqId], flagged: next } }));
    try {
      await api.put(`/api/attempts/${attemptId}/flags/${aqId}`, { flagged: next, clientSessionId: sid.current });
    } catch (e) {
      if ((e as ApiError).isNetwork) markUnreachable();
    }
  }, [attemptId, markUnreachable]);

  const logEvent = React.useCallback((type: IntegrityEventType, detail?: Record<string, unknown>) => {
    if (events.current.length >= 500) return;
    events.current.push({ clientEventId: crypto.randomUUID(), clientSeq: seq.current++, type, clientTime: new Date().toISOString(), detail });
  }, []);

  const sendEvents = React.useCallback(async () => {
    if (!events.current.length || !sid.current) return;
    const batch = events.current.splice(0, 200);
    try {
      await api.post(`/api/attempts/${attemptId}/events`, { clientSessionId: sid.current, events: batch });
    } catch {
      events.current.unshift(...batch); // retry next tick
    }
  }, [attemptId]);

  const applyState = React.useCallback((st: AttemptState, sentAt: number) => {
    clock.sync(st.serverNow, sentAt);
    examId.current = st.examId;
    setAttempt(st);
    setDeadline(st.deadline);
    setStatus(st.status);
    setActiveSession(st.activeSession);
    setPendingRequest(st.pendingRequest ?? null);
    absorbAnnouncements(st.announcements, false);
  }, [absorbAnnouncements, clock]);

  // ---------- load / resume ----------
  const load = React.useCallback(async () => {
    try {
      let sent = Date.now();
      let st = await api.get(`/api/attempts/${attemptId}`, AttemptState);
      if (st.receipt) {
        sessionStorage.setItem(receiptKey(attemptId), JSON.stringify({ receipt: st.receipt, notAccepted: [] } satisfies StoredReceipt));
        setPhase("finalized");
        return;
      }
      let s = sessionStorage.getItem(attemptSessionKey(attemptId));
      if (!s) {
        // opened in a new tab/device: register an open (counts toward the limit)
        s = getOrCreateSession(examSessionKey(st.examId));
        sent = Date.now();
        st = await api.post(`/api/exams/${st.examId}/attempts`, { clientSessionId: s }, AttemptState);
        sessionStorage.setItem(attemptSessionKey(attemptId), s);
      }
      sid.current = s;
      applyState(st, sent);

      const stored = ((await get(pendingKey).catch(() => undefined)) ?? {}) as Record<string, PendingEntry>;
      const map: Record<string, LocalAnswer> = {};
      for (const a of st.answers) {
        const local = stored[a.aqId];
        if (local && local.rev > a.revision) {
          pending.current[a.aqId] = local;
          map[a.aqId] = { value: local.value, rev: local.rev, ackRev: a.revision, flagged: a.flagged, savedAt: a.savedAt, sync: "pending" };
        } else {
          map[a.aqId] = { value: a.value, rev: a.revision, ackRev: a.revision, flagged: a.flagged, savedAt: a.savedAt, sync: "synced" };
        }
      }
      persistPending();
      setAnswers(map);
      setLastAckAt(st.answers.map((a) => a.savedAt).filter(Boolean).sort().at(-1) ?? null);
      setUnreachable(false);
      setPhase("ready");
      if (Object.keys(pending.current).length) {
        toast.info("Restored answers from this device", { description: "Sending them to the server now." });
        flushAll();
      }
    } catch (e) {
      const err = e as ApiError;
      if (err.code === "ALREADY_SUBMITTED") { setPhase("finalized"); return; }
      setLoadError(err.isNetwork ? "You're offline. Any answers you typed are kept on this device. Reconnect and this page will reload." : err.status === 404 ? "We couldn't find this attempt." : err.message);
      setPhase("error");
    }
  }, [applyState, attemptId, flushAll, pendingKey, persistPending]);

  React.useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  // reload automatically when coming back online after a failed load
  React.useEffect(() => {
    if (phase !== "error") return;
    const on = () => load();
    addEventListener("online", on);
    return () => removeEventListener("online", on);
  }, [phase, load]);

  // ---------- heartbeat ----------
  const heartbeat = React.useCallback(async () => {
    if (!sid.current) return;
    const sent = Date.now();
    try {
      const answered = Object.values(answersRef.current).filter((a) => isAnswered(a.value)).length;
      const hb = await api.post(`/api/attempts/${attemptId}/heartbeat`, { clientSessionId: sid.current, answeredCount: answered }, HeartbeatResponse);
      clock.sync(hb.serverNow, sent);
      markReachable();
      setDeadline(hb.deadline);
      setStatus(hb.status);
      setActiveSession(hb.activeSession);
      setPendingRequest(hb.pendingRequest);
      absorbAnnouncements(hb.announcements, true);
      if (Object.keys(pending.current).length) flushAll();
    } catch (e) {
      if ((e as ApiError).isNetwork) markUnreachable();
    }
  }, [absorbAnnouncements, attemptId, clock, flushAll, markReachable, markUnreachable]);
  React.useEffect(() => {
    if (phase !== "ready") return;
    const hb = setInterval(heartbeat, HEARTBEAT_MS);
    const ev = setInterval(sendEvents, EVENTS_MS);
    const online = () => { logEvent("online"); heartbeat(); flushAll(); };
    const offline = () => logEvent("offline");
    const pagehide = () => {
      if (!events.current.length || USE_MOCKS) return;
      const body = JSON.stringify({ clientSessionId: sid.current, events: events.current.splice(0, 200) });
      navigator.sendBeacon?.(`/api/attempts/${attemptId}/events`, new Blob([body], { type: "application/json" }));
    };
    addEventListener("online", online);
    addEventListener("offline", offline);
    addEventListener("pagehide", pagehide);
    return () => {
      clearInterval(hb); clearInterval(ev);
      removeEventListener("online", online); removeEventListener("offline", offline); removeEventListener("pagehide", pagehide);
    };
  }, [phase, heartbeat, sendEvents, flushAll, logEvent, attemptId]);

  // ---------- submit (button and expiry share this path) ----------
  const submit = React.useCallback(async (): Promise<StoredReceipt | null> => {
    if (finalizing.current) return null;
    finalizing.current = true;
    setSubmitting(true);
    try {
      Object.values(debounce.current).forEach(clearTimeout);
      flushAll();
      const until = Date.now() + 4000;
      while (Object.keys(pending.current).length && Date.now() < until) {
        await new Promise((r) => setTimeout(r, 200));
        if (Object.keys(pending.current).some((k) => !inflight.current[k])) flushAll();
      }
      await sendEvents();
      const receipt = await api.post(`/api/attempts/${attemptId}/submit`, { clientSessionId: sid.current }, SubmissionReceipt);
      const qs = attemptRef.current?.questions ?? [];
      const cur = answersRef.current;
      const notAccepted = qs.filter((q) => pending.current[q.aqId] || cur[q.aqId]?.sync === "rejected").map((q) => q.position);
      const stored: StoredReceipt = { receipt, notAccepted };
      sessionStorage.setItem(receiptKey(attemptId), JSON.stringify(stored));
      pending.current = {};
      await del(pendingKey).catch(() => {});
      setPhase("finalized");
      return stored;
    } catch (e) {
      finalizing.current = false;
      const err = e as ApiError;
      if (err.isNetwork) { markUnreachable(); toast.error("Couldn't reach the server to submit", { description: "Your answers are safe on this device. Try again when you're connected." }); }
      else if (err.code === "ATTEMPT_LOCKED") setStatus("locked");
      else if (err.code === "SESSION_SUPERSEDED") setActiveSession(false);
      else toast.error("Submission failed", { description: err.message });
      return null;
    } finally {
      setSubmitting(false);
    }
  }, [attemptId, flushAll, markUnreachable, pendingKey, sendEvents]);
  const takeOver = React.useCallback(async () => {
    try {
      const sent = Date.now();
      const st = await api.post(`/api/exams/${examId.current}/attempts`, { clientSessionId: sid.current }, AttemptState);
      applyState(st, sent);
      flushAll();
    } catch (e) {
      toast.error("Couldn't switch to this window", { description: (e as ApiError).message });
    }
  }, [applyState, flushAll]);

  const pendingCount = Object.values(answers).filter((a) => a.sync === "pending" || a.sync === "saving").length;
  const rejectedCount = Object.values(answers).filter((a) => a.sync === "rejected").length;

  return {
    phase, loadError, attempt, answers, connection, deadline, status, activeSession, announcements, pendingRequest,
    lastAckAt, pendingCount, rejectedCount, submitting, now: clock.now,
    setAnswer, toggleFlag, logEvent, submit, takeOver, refreshStatus: heartbeat,
    reload: () => { setPhase("loading"); load(); },
  };
}

export type ExamEngine = ReturnType<typeof useExamEngine>;
