/**
 * In-browser mock API (NEXT_PUBLIC_USE_MOCKS=1). Implements the PRD business rules closely
 * enough to build and test the UI: server-fixed deadlines, revisioned + idempotent saves,
 * open limit and lock, one idempotent finalization path, and lazy expiry.
 * State lives in localStorage so a refresh behaves like a real server.
 *
 * Dev helpers (browser console):
 *   localStorage.setItem("mock:unreachable", "1")   // simulate server down with Wi-Fi up
 *   window.__mock.reset()                             // wipe demo state
 *   window.__mock.approveLatestRequest()              // act as examiner
 *   window.__mock.announce("Q2 typo fixed")           // examiner announcement
 */
import type {
  AttemptState, CandidateExamCard, CandidateExamEntry, CandidateExamList, CandidateExamStatus, ExamPhase,
  ExaminerDashboard, HeartbeatResponse, Me, SaveAnswerAck, SubmissionReceipt, AnswerValue,
} from "@/contracts";
import { DEFAULT_PREFERENCES } from "@/contracts";
import { DEMO_PASSWORD, EXAMS, PUBLISHED_SCORES, STAT_Q1_QUESTION_COUNT, USERS, type MockExam, type MockUser } from "./fixtures";

const KEY = "mock:db:v1";
const GRACE_MS = 2000;

interface MAnswer { value: AnswerValue | null; revision: number; flagged: boolean; savedAt: string | null; opIds: string[] }
interface MAttempt {
  id: string; examId: string; userId: string; isSandbox: boolean;
  status: AttemptState["status"]; seed: number; startedAt: string; deadline: string;
  order: string[]; optionOrder: Record<string, string[]>;
  answers: Record<string, MAnswer>; // keyed by aqId
  aqMap: Record<string, string>; // aqId -> source question id
  sessions: string[]; activeSession: string; extraOpens: number;
  receipt: SubmissionReceipt | null;
  events: number;
  request: { id: string; type: "unlock" | "reattempt"; status: "pending" | "approved" | "denied"; note: string | null } | null;
}
interface MDb {
  epoch: number;
  session: string | null;
  prefs: Record<string, Partial<Me["preferences"]>>;
  attempts: MAttempt[];
  announcements: { id: string; examId: string; body: string; createdAt: string }[];
  reattemptGranted: Record<string, boolean>; // `${examId}:${userId}`
}

const uid = () => crypto.randomUUID();
const iso = (ms: number) => new Date(ms).toISOString();

function load(): MDb {
  const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
  if (raw) return JSON.parse(raw) as MDb;
  const db: MDb = { epoch: Date.now(), session: null, prefs: {}, attempts: [], announcements: [], reattemptGranted: {} };
  save(db);
  return db;
}
function save(db: MDb) {
  localStorage.setItem(KEY, JSON.stringify(db));
}

// ---------- helpers ----------
type Res = { status: number; json: unknown };
const ok = (json: unknown, status = 200): Res => ({ status, json });
const fail = (status: number, code: string, message: string, extra?: object): Res => ({ status, json: { error: { code, message, ...extra } } });

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle<T>(arr: T[], rnd: () => number) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const opens = (db: MDb, e: MockExam) => db.epoch + e.opensOffsetMin * 60000;
const closes = (db: MDb, e: MockExam) => db.epoch + e.closesOffsetMin * 60000;

function phase(db: MDb, e: MockExam, now: number): ExamPhase {
  if (e.status === "draft") return "draft";
  if (e.resultsPublished) return "results_published";
  if (now < opens(db, e)) return "scheduled";
  if (now < closes(db, e)) return "ongoing";
  return "completed";
}

function me(db: MDb): MockUser | null {
  const u = USERS.find((x) => x.id === db.session);
  return u && u.isActive ? u : null;
}

function answeredCount(a: MAttempt) {
  return Object.values(a.answers).filter((x) => isAnswered(x.value)).length;
}
function isAnswered(v: AnswerValue | null) {
  if (!v) return false;
  return "text" in v ? v.text.trim().length > 0 : v.optionIds.length > 0;
}

/** BR-10: single idempotent finalization path. */
function finalize(db: MDb, a: MAttempt, reason: SubmissionReceipt["reason"]): SubmissionReceipt {
  if (a.receipt) return a.receipt;
  const e = EXAMS.find((x) => x.id === a.examId)!;
  const answered = answeredCount(a);
  a.status = reason === "submit" ? "submitted" : "expired";
  const code = `FM-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  a.receipt = {
    attemptId: a.id, examTitle: e.title, receiptCode: code,
    finalizedAt: iso(reason === "expiry" ? Math.min(Date.now(), Date.parse(a.deadline)) : Date.now()),
    reason, acceptedCount: answered, unansweredCount: a.order.length - answered, questionCount: a.order.length,
    resultsStatus: "pending",
    canRequestReattempt: !a.isSandbox && e.settings.maxReattempts > 0 && phase(db, e, Date.now()) === "ongoing",
  };
  return a.receipt;
}

/** BR-11 lazy sweep. */
function sweep(db: MDb) {
  const now = Date.now();
  for (const a of db.attempts) {
    if ((a.status === "in_progress" || a.status === "locked") && now > Date.parse(a.deadline) + GRACE_MS) finalize(db, a, "expiry");
  }
}

function attemptState(db: MDb, a: MAttempt, clientSessionId?: string): AttemptState {
  const e = EXAMS.find((x) => x.id === a.examId)!;
  return {
    attemptId: a.id, examId: e.id, examTitle: e.title, isSandbox: a.isSandbox, status: a.status,
    serverNow: iso(Date.now()), deadline: a.deadline, durationMin: e.durationMin, totalMarks: e.totalMarks,
    questions: a.order.map((aqId, i) => {
      const q = e.questions.find((x) => x.id === a.aqMap[aqId])!;
      return {
        aqId, position: i + 1, type: q.type, topic: q.topic, prompt: q.prompt, marks: q.marks,
        options: q.options ? a.optionOrder[aqId].map((oid) => ({ id: oid, label: q.options!.find((o) => o.id === oid)!.label })) : undefined,
        multiRule: q.multiRule,
      };
    }),
    answers: a.order.map((aqId) => ({ aqId, value: a.answers[aqId].value, revision: a.answers[aqId].revision, flagged: a.answers[aqId].flagged, savedAt: a.answers[aqId].savedAt })),
    policy: {
      pastePolicy: e.settings.pastePolicy, fullscreenRequired: e.settings.fullscreenRequired, allowMobile: e.settings.allowMobile,
      maxOpens: e.settings.maxOpens + a.extraOpens, opensUsed: a.sessions.length, cameraCheck: e.settings.cameraCheck,
    },
    announcements: db.announcements.filter((x) => x.examId === e.id),
    activeSession: clientSessionId ? a.activeSession === clientSessionId : true,
    pendingRequest: a.request,
    receipt: a.receipt,
  };
}

function candidateCard(db: MDb, e: MockExam, userId: string, now: number): CandidateExamCard {
  const attempts = db.attempts.filter((x) => x.examId === e.id && x.userId === userId && !x.isSandbox);
  const live = attempts.find((x) => x.status !== "voided");
  const ph = phase(db, e, now);
  let status: CandidateExamStatus = "not_started";
  if (e.resultsPublished) status = "results_published";
  else if (live) status = live.status === "in_progress" ? "in_progress" : live.status === "locked" ? "locked" : live.status === "submitted" ? "submitted" : "expired";
  else if (db.reattemptGranted[`${e.id}:${userId}`]) status = "reattempt_granted";
  else if (ph === "completed") status = "missed";
  return {
    examId: e.id, title: e.title, code: e.code, examinerName: USERS.find((u) => u.id === e.ownerId)!.name, phase: ph,
    opensAt: iso(opens(db, e)), closesAt: iso(closes(db, e)), durationMin: e.durationMin, totalMarks: e.totalMarks,
    questionCount: e.questions.length || STAT_Q1_QUESTION_COUNT, status, attemptId: live?.id ?? null,
    deadline: live && (live.status === "in_progress" || live.status === "locked") ? live.deadline : null,
    scorePct: e.resultsPublished ? PUBLISHED_SCORES[userId] ?? null : null,
  };
}

// ---------- routes ----------
type Handler = (p: string[], body: Record<string, unknown>, db: MDb) => Res;
const routes: [string, RegExp, Handler][] = [];
const on = (m: string, pattern: string, h: Handler) => routes.push([m, new RegExp(`^${pattern.replace(/:\w+/g, "([^/]+)")}$`), h]);

on("POST", "/api/auth/login", (_p, b, db) => {
  const u = USERS.find((x) => x.email === String(b.email ?? "").toLowerCase().trim());
  if (!u || b.password !== DEMO_PASSWORD) return fail(401, "UNAUTHENTICATED", "Email or password is incorrect.");
  if (!u.isActive) return fail(401, "UNAUTHENTICATED", "This account is disabled. Contact your administrator.");
  db.session = u.id;
  return ok({ id: u.id, name: u.name, email: u.email, role: u.role, preferences: { ...DEFAULT_PREFERENCES, ...db.prefs[u.id] } } satisfies Me);
});
on("POST", "/api/auth/logout", (_p, _b, db) => { db.session = null; return ok({ ok: true }); });
on("GET", "/api/auth/me", (_p, _b, db) => {
  const u = me(db);
  if (!u) return fail(401, "UNAUTHENTICATED", "Please sign in.");
  return ok({ id: u.id, name: u.name, email: u.email, role: u.role, preferences: { ...DEFAULT_PREFERENCES, ...db.prefs[u.id] } } satisfies Me);
});
on("PUT", "/api/me/preferences", (_p, b, db) => {
  const u = me(db)!;
  db.prefs[u.id] = { ...db.prefs[u.id], ...b };
  return ok({ ...DEFAULT_PREFERENCES, ...db.prefs[u.id] });
});

on("GET", "/api/me/exams", (_p, _b, db) => {
  const u = me(db)!;
  if (u.role !== "candidate") return fail(403, "FORBIDDEN", "Candidates only.");
  const now = Date.now();
  const cards = EXAMS.filter((e) => e.enrolled.includes(u.id) && e.status === "published").map((e) => candidateCard(db, e, u.id, now));
  const res: CandidateExamList = {
    serverNow: iso(now),
    available: cards.filter((c) => c.phase === "ongoing" && ["not_started", "in_progress", "locked", "reattempt_granted"].includes(c.status)),
    upcoming: cards.filter((c) => c.phase === "scheduled"),
    completed: cards.filter((c) => !(c.phase === "scheduled") && !(c.phase === "ongoing" && ["not_started", "in_progress", "locked", "reattempt_granted"].includes(c.status))),
  };
  return ok(res);
});

on("GET", "/api/me/exams/:id", ([id], _b, db) => {
  const u = me(db)!;
  const e = EXAMS.find((x) => x.id === id && x.enrolled.includes(u.id) && x.status === "published");
  if (!e) return fail(404, "NOT_FOUND", "Exam not found.");
  const now = Date.now();
  const card = candidateCard(db, e, u.id, now);
  const live = db.attempts.find((x) => x.id === card.attemptId);
  const multis = e.questions.filter((q) => q.type === "multi");
  const res: CandidateExamEntry = {
    ...card, instructions: e.instructions, settings: e.settings, serverNow: iso(now),
    multiSelectRule: multis.length === 0 || multis.every((q) => (q.multiRule ?? "exact") === "exact") ? "exact" : multis.every((q) => q.multiRule === "partial") ? "partial" : "mixed",
    typeCounts: { single: e.questions.filter((q) => q.type === "single").length, multi: multis.length, written: e.questions.filter((q) => q.type === "written").length },
    opensUsed: live?.sessions.length ?? 0,
  };
  return ok(res);
});

on("POST", "/api/exams/:id/attempts", ([id], b, db) => {
  const u = me(db)!;
  const sid = String(b.clientSessionId ?? "");
  const e = EXAMS.find((x) => x.id === id);
  if (!e || !e.enrolled.includes(u.id) || e.status !== "published") return fail(404, "NOT_FOUND", "Exam not found.");
  const now = Date.now();
  const ph = phase(db, e, now);
  if (ph === "scheduled") return fail(403, "EXAM_NOT_OPEN", "This exam hasn't opened yet.");
  if (ph !== "ongoing") return fail(403, "EXAM_CLOSED", "This exam has closed.");
  const existing = db.attempts.find((x) => x.examId === e.id && x.userId === u.id && !x.isSandbox && x.status !== "voided");
  if (existing) {
    if (existing.status === "submitted" || existing.status === "expired") return fail(409, "ALREADY_SUBMITTED", "You have already submitted this exam.");
    if (!existing.sessions.includes(sid)) {
      existing.sessions.push(sid);
      if (existing.sessions.length > e.settings.maxOpens + existing.extraOpens) existing.status = "locked";
    }
    existing.activeSession = sid;
    return ok(attemptState(db, existing, sid));
  }
  const seed = Math.floor(Math.random() * 2 ** 31);
  const rnd = mulberry32(seed);
  const qs = e.settings.shuffleQuestions ? shuffle(e.questions, rnd) : e.questions;
  const a: MAttempt = {
    id: uid(), examId: e.id, userId: u.id, isSandbox: false, status: "in_progress", seed,
    startedAt: iso(now), deadline: iso(Math.min(closes(db, e), now + e.durationMin * 60000)),
    order: [], optionOrder: {}, answers: {}, aqMap: {}, sessions: [sid], activeSession: sid, extraOpens: 0,
    receipt: null, events: 0, request: null,
  };
  for (const q of qs) {
    const aqId = uid();
    a.order.push(aqId); a.aqMap[aqId] = q.id;
    a.answers[aqId] = { value: null, revision: 0, flagged: false, savedAt: null, opIds: [] };
    if (q.options) a.optionOrder[aqId] = (e.settings.shuffleOptions ? shuffle(q.options, rnd) : q.options).map((o) => o.id);
  }
  delete db.reattemptGranted[`${e.id}:${u.id}`];
  db.attempts.push(a);
  return ok(attemptState(db, a, sid), 201);
});

function ownAttempt(db: MDb, id: string) {
  const u = me(db)!;
  return db.attempts.find((x) => x.id === id && x.userId === u.id) ?? null;
}

on("GET", "/api/attempts/:id", ([id], _b, db) => {
  const a = ownAttempt(db, id);
  if (!a) return fail(404, "NOT_FOUND", "Attempt not found.");
  const sid = typeof window !== "undefined" ? sessionStorage.getItem(`exam:session:${id}`) ?? undefined : undefined;
  return ok(attemptState(db, a, sid));
});

on("PUT", "/api/attempts/:id/answers/:aq", ([id, aq], b, db) => {
  const a = ownAttempt(db, id);
  if (!a || !a.answers[aq]) return fail(404, "NOT_FOUND", "Question not found.");
  if (a.activeSession !== b.clientSessionId) return fail(409, "SESSION_SUPERSEDED", "This exam is open in another window.");
  if (a.status === "locked") return fail(423, "ATTEMPT_LOCKED", "This attempt is locked.");
  if (a.status !== "in_progress" || Date.now() > Date.parse(a.deadline) + GRACE_MS) return fail(409, "ATTEMPT_CLOSED", "Time is up. This change was not accepted.");
  const cur = a.answers[aq];
  const opId = String(b.clientOpId);
  if (cur.opIds.includes(opId)) return ok({ aqId: aq, revision: cur.revision, savedAt: cur.savedAt! } satisfies SaveAnswerAck);
  const rev = Number(b.revision);
  if (rev <= cur.revision) return fail(409, "STALE_REVISION", "A newer version of this answer is already saved.", { details: { revision: cur.revision, value: cur.value } });
  cur.value = (b.value as AnswerValue) ?? null; cur.revision = rev; cur.savedAt = iso(Date.now()); cur.opIds = [...cur.opIds.slice(-20), opId];
  return ok({ aqId: aq, revision: rev, savedAt: cur.savedAt } satisfies SaveAnswerAck);
});

on("PUT", "/api/attempts/:id/flags/:aq", ([id, aq], b, db) => {
  const a = ownAttempt(db, id);
  if (!a || !a.answers[aq]) return fail(404, "NOT_FOUND", "Question not found.");
  if (a.status !== "in_progress") return fail(409, "ATTEMPT_CLOSED", "This attempt is closed.");
  a.answers[aq].flagged = Boolean(b.flagged);
  return ok({ ok: true });
});

on("POST", "/api/attempts/:id/heartbeat", ([id], b, db) => {
  const a = ownAttempt(db, id);
  if (!a) return fail(404, "NOT_FOUND", "Attempt not found.");
  const res: HeartbeatResponse = {
    serverNow: iso(Date.now()), deadline: a.deadline, status: a.status, activeSession: a.activeSession === b.clientSessionId,
    announcements: db.announcements.filter((x) => x.examId === a.examId), pendingRequest: a.request,
  };
  return ok(res);
});

on("POST", "/api/attempts/:id/events", ([id], b, db) => {
  const a = ownAttempt(db, id);
  if (!a) return fail(404, "NOT_FOUND", "Attempt not found.");
  const events = (b.events as unknown[]) ?? [];
  a.events += events.length;
  return ok({ accepted: events.length });
});

on("POST", "/api/attempts/:id/submit", ([id], b, db) => {
  const a = ownAttempt(db, id);
  if (!a) return fail(404, "NOT_FOUND", "Attempt not found.");
  if (a.receipt) return ok(a.receipt);
  if (a.status === "locked") return fail(423, "ATTEMPT_LOCKED", "This attempt is locked.");
  if (a.activeSession !== b.clientSessionId) return fail(409, "SESSION_SUPERSEDED", "This exam is open in another window.");
  return ok(finalize(db, a, Date.now() > Date.parse(a.deadline) ? "expiry" : "submit"));
});

on("POST", "/api/attempts/:id/requests", ([id], b, db) => {
  const a = ownAttempt(db, id);
  if (!a) return fail(404, "NOT_FOUND", "Attempt not found.");
  if (a.request?.status === "pending") return fail(409, "REQUEST_NOT_ALLOWED", "You already have a pending request.");
  const type = b.type as "unlock" | "reattempt";
  if (type === "unlock" && a.status !== "locked") return fail(409, "REQUEST_NOT_ALLOWED", "This attempt isn't locked.");
  if (type === "reattempt" && !a.receipt?.canRequestReattempt) return fail(409, "REQUEST_NOT_ALLOWED", "A re-attempt can't be requested for this exam.");
  if (String(b.reason ?? "").trim().length < 10) return fail(422, "VALIDATION", "Please describe what happened.", { fields: { reason: "At least 10 characters" } });
  a.request = { id: uid(), type, status: "pending", note: null };
  return ok(a.request, 201);
});

on("GET", "/api/exams", (_p, _b, db) => {
  const u = me(db)!;
  if (u.role === "candidate") return fail(403, "FORBIDDEN", "Examiners only.");
  const now = Date.now();
  const mine = EXAMS.filter((e) => u.role === "admin" || e.ownerId === u.id);
  const res: ExaminerDashboard = {
    serverNow: iso(now),
    exams: mine.map((e) => {
      const at = db.attempts.filter((x) => x.examId === e.id && !x.isSandbox && x.status !== "voided");
      const isStat = e.code === "STAT-Q1";
      return {
        examId: e.id, title: e.title, code: e.code, phase: phase(db, e, now), opensAt: iso(opens(db, e)), closesAt: iso(closes(db, e)),
        durationMin: e.durationMin, totalMarks: e.totalMarks, questionCount: e.questions.length || (isStat ? STAT_Q1_QUESTION_COUNT : 0),
        enrolled: isStat ? 24 : e.enrolled.length, inProgress: at.filter((x) => x.status === "in_progress").length,
        submitted: isStat ? 24 : at.filter((x) => x.status === "submitted" || x.status === "expired").length,
        awaitingGrading: at.filter((x) => (x.status === "submitted" || x.status === "expired") && e.questions.some((q) => q.type === "written")).length,
        pendingRequests: at.filter((x) => x.request?.status === "pending").length,
        priorityIncidents: isStat ? 1 : 0,
      };
    }),
  };
  return ok(res);
});

// ---------- entry ----------
export async function mockFetch(method: string, path: string, body?: unknown): Promise<Res> {
  await new Promise((r) => setTimeout(r, 120 + Math.random() * 230));
  if (typeof navigator !== "undefined" && !navigator.onLine) throw new TypeError("offline");
  if (localStorage.getItem("mock:unreachable") === "1") throw new TypeError("unreachable");
  const db = load();
  sweep(db);
  const url = path.split("?")[0];
  for (const [m, re, h] of routes) {
    if (m !== method) continue;
    const match = url.match(re);
    if (!match) continue;
    if (!url.startsWith("/api/auth/login") && !me(db)) { save(db); return fail(401, "UNAUTHENTICATED", "Please sign in."); }
    const res = h(match.slice(1), (body ?? {}) as Record<string, unknown>, db);
    save(db);
    return JSON.parse(JSON.stringify(res));
  }
  return fail(404, "NOT_FOUND", `No mock for ${method} ${url}`);
}

if (typeof window !== "undefined") {
  (window as unknown as { __mock: object }).__mock = {
    reset: () => { localStorage.removeItem(KEY); location.reload(); },
    approveLatestRequest: () => {
      const db = load();
      const a = [...db.attempts].reverse().find((x) => x.request?.status === "pending");
      if (!a || !a.request) return "no pending request";
      a.request.status = "approved"; a.request.note = "Approved by examiner (mock).";
      if (a.request.type === "unlock") { a.status = "in_progress"; a.extraOpens += 1; }
      else { a.status = "voided"; db.reattemptGranted[`${a.examId}:${a.userId}`] = true; }
      save(db); return "approved";
    },
    announce: (body: string) => {
      const db = load();
      db.announcements.push({ id: uid(), examId: EXAMS[0].id, body, createdAt: iso(Date.now()) });
      save(db); return "sent";
    },
  };
}
