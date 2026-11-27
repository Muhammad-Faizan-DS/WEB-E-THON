/**
 * In-browser mock API (NEXT_PUBLIC_USE_MOCKS=1). Implements the PRD business rules closely
 * enough to build and test the UI: server-fixed deadlines, revisioned + idempotent saves,
 * open limit and lock, one idempotent finalization path, lazy expiry, observations,
 * incident grouping (the real pure engine), requests and announcements.
 * State lives in localStorage so a refresh behaves like a real server. Each browser has its own data.
 *
 * Dev helpers (browser console):
 *   localStorage.setItem("mock:unreachable", "1")   // simulate server down with Wi-Fi up
 *   window.__mock.reset()                             // wipe demo state
 *   window.__mock.approveLatestRequest()              // act as examiner
 *   window.__mock.announce("Q2 typo fixed")           // examiner announcement
 */
import type {
  AnswerValue, AttemptState, AttemptTimeline, CandidateExamCard, CandidateExamEntry, CandidateExamList,
  CandidateExamStatus, ExamMonitor, ExamPhase, ExamRequest, ExaminerDashboard, HeartbeatResponse, IncidentReview,
  Me, MonitorRow, SaveAnswerAck, SubmissionReceipt,
} from "@/contracts";
import { DEFAULT_PREFERENCES } from "@/contracts";
import { countBySeverity, groupIncidents, type StoredObservation } from "@/server/incidents/group";
import { DEMO_PASSWORD, EXAMS, PUBLISHED_SCORES, SIMULATED, STAT_Q1_QUESTION_COUNT, USERS, type MockExam, type MockQuestion, type MockUser } from "./fixtures";

const KEY = "mock:db:v2";
const GRACE_MS = 2000;

interface MAnswer { value: AnswerValue | null; revision: number; flagged: boolean; savedAt: string | null; opIds: string[] }
interface MRequest {
  id: string; type: "unlock" | "reattempt"; status: "pending" | "approved" | "denied";
  reasonCategory: ExamRequest["reasonCategory"]; reason: string; createdAt: string;
  decidedAt: string | null; decidedBy: string | null; note: string | null;
}
interface MAttempt {
  id: string; examId: string; userId: string; isSandbox: boolean;
  status: AttemptState["status"]; seed: number; startedAt: string; deadline: string;
  order: string[]; optionOrder: Record<string, string[]>;
  answers: Record<string, MAnswer>; // keyed by aqId
  aqMap: Record<string, string>; // aqId -> source question id
  sessions: { id: string; openedAt: string; ua: string }[];
  activeSession: string; extraOpens: number;
  receipt: SubmissionReceipt | null;
  events: StoredObservation[];
  lastSeenAt: string | null;
  requests: MRequest[];
  sim?: "live" | "static";
}
interface MDb {
  epoch: number;
  session: string | null;
  prefs: Record<string, Partial<Me["preferences"]>>;
  attempts: MAttempt[];
  announcements: { id: string; examId: string; body: string; createdAt: string }[];
  reattemptGranted: Record<string, boolean>; // `${examId}:${userId}`
  reviews: Record<string, IncidentReview>;
  /** proctoring additions (guide features); created lazily so older stored DBs keep working */
  proctor?: MProctor;
}
interface MMessage {
  id: string; examId: string; attemptId: string; from: "examiner" | "candidate";
  kind: "message" | "reminder" | "help"; category: "question" | "technical" | "break" | null;
  body: string; createdAt: string; by: string; resolvedAt: string | null;
}
interface MProctor {
  messages: MMessage[];
  acks: Record<string, string[]>; // announcementId -> userIds
  extensions: { id: string; examId: string; attemptId: string | null; minutes: number; reason: string; by: string; at: string; affected: number }[];
  issues: { id: string; examId: string | null; category: string; body: string; by: string; role: string; at: string }[];
  notes: Record<string, string>; // examId -> examiner-only instructions
  closedAt: Record<string, string>; // examId -> when the examiner closed it early
}
const px = (db: MDb): MProctor => {
  // data stored by an earlier build may lack newer fields: fill them in instead of crashing
  const p = (db.proctor ??= { messages: [], acks: {}, extensions: [], issues: [], notes: {}, closedAt: {} });
  p.messages ??= []; p.acks ??= {}; p.extensions ??= []; p.issues ??= []; p.notes ??= {}; p.closedAt ??= {};
  return p;
};

/** Admin state: disabled accounts, one-time passwords issued by a reset, and the admin audit trail. */
interface MAdmin {
  disabled: string[];
  passwords: Record<string, string>; // userId -> one-time temporary password from a reset (must be exchanged)
  custom?: Record<string, string>; // userId -> password the user chose after a reset
  audit: { id: string; at: string; by: string; action: string; target: string; note: string }[];
}
const adm = (db: MDb): MAdmin => {
  const a = ((db as MDb & { admin?: MAdmin }).admin ??= { disabled: [], passwords: {}, audit: [] });
  a.disabled ??= []; a.passwords ??= {}; a.audit ??= []; a.custom ??= {};
  return a;
};

const uid = () => crypto.randomUUID();
const iso = (ms: number) => new Date(ms).toISOString();

/** Exams examiners create in this browser live in the mock DB and join the fixture list on every load. */
function mergeCustomExams(db: MDb) {
  for (const e of (db as MDb & { customExams?: MockExam[] }).customExams ?? []) {
    const i = EXAMS.findIndex((x) => x.id === e.id);
    if (i < 0) EXAMS.push(e);
    else EXAMS[i] = e;
  }
}

function load(): MDb {
  const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
  if (raw) { const db = JSON.parse(raw) as MDb; mergeCustomExams(db); return db; }
  const db: MDb = { epoch: Date.now(), session: null, prefs: {}, attempts: [], announcements: [], reattemptGranted: {}, reviews: {} };
  seedSimulated(db);
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
const closes = (db: MDb, e: MockExam) => {
  const planned = db.epoch + e.closesOffsetMin * 60000;
  const early = db.proctor?.closedAt[e.id];
  return early ? Math.min(planned, Date.parse(early)) : planned;
};
const userById = (id: string) => USERS.find((u) => u.id === id)!;
const examById = (id: string) => EXAMS.find((e) => e.id === id);

function phase(db: MDb, e: MockExam, now: number): ExamPhase {
  if (e.status === "draft") return "draft";
  if (e.resultsPublished) return "results_published";
  if (now < opens(db, e)) return "scheduled";
  if (now < closes(db, e)) return "ongoing";
  return "completed";
}

function me(db: MDb): MockUser | null {
  const u = USERS.find((x) => x.id === db.session);
  return u && u.isActive && !adm(db).disabled.includes(u.id) ? u : null;
}

function isAnswered(v: AnswerValue | null) {
  if (!v) return false;
  return "text" in v ? v.text.trim().length > 0 : v.optionIds.length > 0;
}
const answeredCount = (a: MAttempt) => Object.values(a.answers).filter((x) => isAnswered(x.value)).length;

function serverEvent(a: MAttempt, type: StoredObservation["type"], detail?: Record<string, unknown>, at = Date.now()) {
  a.events.push({ id: uid(), clientSeq: (a.events.at(-1)?.clientSeq ?? 0) + 1, type, clientTime: iso(at), serverTime: iso(at), detail });
}

function createAttempt(db: MDb, e: MockExam, userId: string, startMs: number, sid: string, ua = navigator.userAgent): MAttempt {
  const seed = Math.floor(Math.random() * 2 ** 31);
  const rnd = mulberry32(seed);
  const qs = e.settings.shuffleQuestions ? shuffle(e.questions, rnd) : e.questions;
  const a: MAttempt = {
    id: uid(), examId: e.id, userId, isSandbox: false, status: "in_progress", seed,
    startedAt: iso(startMs), deadline: iso(Math.min(closes(db, e), startMs + e.durationMin * 60000)),
    order: [], optionOrder: {}, answers: {}, aqMap: {}, sessions: [{ id: sid, openedAt: iso(startMs), ua }],
    activeSession: sid, extraOpens: 0, receipt: null, events: [], lastSeenAt: iso(startMs), requests: [],
  };
  for (const q of qs) {
    const aqId = uid();
    a.order.push(aqId); a.aqMap[aqId] = q.id;
    a.answers[aqId] = { value: null, revision: 0, flagged: false, savedAt: null, opIds: [] };
    if (q.options) a.optionOrder[aqId] = (e.settings.shuffleOptions ? shuffle(q.options, rnd) : q.options).map((o) => o.id);
  }
  db.attempts.push(a);
  return a;
}

/** BR-10: single idempotent finalization path. */
function finalize(db: MDb, a: MAttempt, reason: SubmissionReceipt["reason"]): SubmissionReceipt {
  if (a.receipt) return a.receipt;
  const e = examById(a.examId)!;
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

const pendingReq = (a: MAttempt) => a.requests.find((r) => r.status === "pending") ?? null;
const latestReq = (a: MAttempt) => a.requests.at(-1) ?? null;

// ---------- simulated cohort (monitor demo) ----------
function seedSimulated(db: MDb) {
  const e = EXAMS[0];
  const [hamza, zainab, usman, fatima, ahmed] = SIMULATED;
  const start = db.epoch - 6 * 60000;
  const fill = (a: MAttempt, n: number) => a.order.slice(0, n).forEach((aqId, i) => {
    const q = e.questions.find((x) => x.id === a.aqMap[aqId])!;
    a.answers[aqId] = {
      value: q.type === "written" ? { text: "Because most examples are negative, predicting the majority class scores high accuracy. Precision and recall show the minority class." } : { optionIds: q.key!.slice(0, q.type === "multi" ? 2 : 1) },
      revision: 2 + i, flagged: false, savedAt: iso(start + (i + 1) * 70000), opIds: [],
    };
  });
  const at = (sec: number) => start + sec * 1000;
  const ev = (a: MAttempt, sec: number, type: StoredObservation["type"], detail?: Record<string, unknown>, delay = 0.4) =>
    a.events.push({ id: uid(), clientSeq: a.events.length, type, clientTime: iso(at(sec)), serverTime: iso(at(sec + delay)), detail });

  const h = createAttempt(db, e, hamza, start, uid(), "Chrome 131 on Windows");
  fill(h, 1); h.sim = "live"; h.lastSeenAt = iso(db.epoch);
  ev(h, 40, "window_blur"); ev(h, 42, "window_focus");

  const z = createAttempt(db, e, zainab, start + 20000, uid(), "Chrome 131 on macOS");
  fill(z, 2); z.sim = "live"; z.lastSeenAt = iso(db.epoch);
  ev(z, 95, "window_blur"); ev(z, 96.5, "window_focus");
  ev(z, 302, "visibility_hidden"); ev(z, 302.3, "window_blur");
  ev(z, 347, "visibility_visible"); ev(z, 347.1, "window_focus");
  ev(z, 349, "paste", { chars: 348, outcome: "blocked", position: 3, aqId: z.order[2] });

  const u = createAttempt(db, e, usman, start + 45000, uid(), "Edge 131 on Windows");
  fill(u, 2); u.sim = "static"; u.lastSeenAt = iso(db.epoch - 70000);
  ev(u, 120, "offline", undefined, 0.2); ev(u, 151, "online", undefined, 0.2);
  ev(u, 290, "offline", undefined, 0.2);

  const f = createAttempt(db, e, fatima, start - 9 * 60000, uid(), "Firefox 133 on Windows");
  fill(f, 3); f.sim = "static";
  ev(f, -400, "visibility_hidden"); ev(f, -388, "visibility_visible");
  finalize(db, f, "submit");
  f.receipt!.finalizedAt = iso(db.epoch - 60000);
  db.reviews[`${f.id}:${f.events[0].id}`] = { decision: "dismissed", note: "Candidate reported a notification popup; returned within 12 s, no paste.", reviewer: "Dr. Hina Rauf", reviewedAt: iso(db.epoch - 30000) };

  const r = createAttempt(db, e, ahmed, start + 60000, uid(), "Chrome 130 on Windows");
  fill(r, 1); r.sim = "static"; r.lastSeenAt = iso(db.epoch - 20000);
  for (let i = 2; i <= 4; i++) {
    r.sessions.push({ id: uid(), openedAt: iso(at(60 + i * 40)), ua: i === 4 ? "Chrome 130 on Android" : "Chrome 130 on Windows" });
    ev(r, 60 + i * 40, "session_opened", { open: i, max: e.settings.maxOpens }, 0);
  }
  r.status = "locked";
  r.requests.push({
    id: uid(), type: "unlock", status: "pending", reasonCategory: "device",
    reason: "My laptop restarted for an update, then the browser reopened the exam twice. I also tried my phone before the laptop came back.",
    createdAt: iso(db.epoch - 15000), decidedAt: null, decidedBy: null, note: null,
  });
}

function attemptState(db: MDb, a: MAttempt, clientSessionId?: string): AttemptState {
  const e = examById(a.examId)!;
  const req = latestReq(a);
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
    pendingRequest: req ? { id: req.id, type: req.type, status: req.status, note: req.note } : null,
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
    examId: e.id, title: e.title, code: e.code, examinerName: userById(e.ownerId).name, phase: ph,
    opensAt: iso(opens(db, e)), closesAt: iso(closes(db, e)), durationMin: e.durationMin, totalMarks: e.totalMarks,
    questionCount: e.questions.length || STAT_Q1_QUESTION_COUNT, status, attemptId: live?.id ?? null,
    deadline: live && (live.status === "in_progress" || live.status === "locked") ? live.deadline : null,
    scorePct: e.resultsPublished ? PUBLISHED_SCORES[userId] ?? null : null,
  };
}

function contactOf(a: MAttempt, now: number): MonitorRow["contact"] {
  if (a.status !== "in_progress" && a.status !== "locked") return "none";
  if (!a.lastSeenAt) return "lost";
  const age = now - Date.parse(a.lastSeenAt);
  return age < 30000 ? "live" : age < 90000 ? "stale" : "lost";
}

function incidentsOf(db: MDb, a: MAttempt) {
  return groupIncidents(a.id, a.events, db.reviews);
}

/** Simulated candidates stay "live" and make slow progress, so the monitor feels real. */
function tickSimulation(db: MDb, now: number) {
  for (const a of db.attempts) {
    if (a.sim !== "live" || a.status !== "in_progress") continue;
    a.lastSeenAt = iso(now - 1000 - Math.random() * 8000);
    const next = a.order.find((id) => !isAnswered(a.answers[id].value));
    if (next && Math.random() < 0.08) {
      const e = examById(a.examId)!;
      const q = e.questions.find((x) => x.id === a.aqMap[next])!;
      a.answers[next] = { value: q.type === "written" ? { text: "Accuracy hides the minority class; check recall." } : { optionIds: [q.options![0].id] }, revision: 1, flagged: false, savedAt: iso(now), opIds: [] };
    }
  }
}

function examOwned(db: MDb, id: string) {
  const u = me(db)!;
  const e = examById(id);
  if (!e || (u.role !== "admin" && e.ownerId !== u.id)) return null;
  return e;
}

// ---------- routes ----------
type Handler = (p: string[], body: Record<string, unknown>, db: MDb) => Res;
const routes: [string, RegExp, Handler][] = [];
const on = (m: string, pattern: string, h: Handler) => routes.push([m, new RegExp(`^${pattern.replace(/:\w+/g, "([^/]+)")}$`), h]);

const meDto = (db: MDb, u: MockUser): Me => ({ id: u.id, name: u.name, email: u.email, role: u.role, preferences: { ...DEFAULT_PREFERENCES, ...db.prefs[u.id] } });

on("POST", "/api/auth/login", (_p, b, db) => {
  const u = USERS.find((x) => x.email === String(b.email ?? "").toLowerCase().trim());
  if (!u) return fail(401, "UNAUTHENTICATED", "Email or password is incorrect.");
  const A = adm(db);
  const temp = A.passwords[u.id];
  if (temp) {
    // after a reset only the temporary password works, and only to choose a new one (it never opens a session)
    if (b.password !== temp) return fail(401, "UNAUTHENTICATED", "Email or password is incorrect.");
    if (!u.isActive || A.disabled.includes(u.id)) return fail(401, "UNAUTHENTICATED", "This account is disabled. Contact your administrator.");
    return fail(409, "PASSWORD_CHANGE_REQUIRED", "This is a temporary password. Choose a new password to finish signing in.");
  }
  if (b.password !== (A.custom![u.id] ?? DEMO_PASSWORD)) return fail(401, "UNAUTHENTICATED", "Email or password is incorrect.");
  if (!u.isActive || A.disabled.includes(u.id)) return fail(401, "UNAUTHENTICATED", "This account is disabled. Contact your administrator.");
  db.session = u.id;
  return ok(meDto(db, u));
});
on("POST", "/api/auth/logout", (_p, _b, db) => { db.session = null; return ok({ ok: true }); });
on("POST", "/api/auth/complete-reset", (_p, b, db) => {
  const u = USERS.find((x) => x.email === String(b.email ?? "").toLowerCase().trim());
  const A = adm(db);
  const temp = u ? A.passwords[u.id] : undefined;
  if (!u || !temp || b.temporaryPassword !== temp) return fail(401, "UNAUTHENTICATED", "That temporary password is no longer valid. Ask your administrator for a new one.");
  const next = String(b.newPassword ?? "");
  if (next.length < 8 || !/[A-Za-z]/.test(next) || !/[0-9]/.test(next) || next === temp) return fail(422, "VALIDATION", "Use at least 8 characters with a letter and a number, different from the temporary password.");
  A.custom![u.id] = next;
  delete A.passwords[u.id]; // used once, gone
  A.audit.push({ id: uid(), at: iso(Date.now()), by: u.email, action: "Completed password reset", target: u.email, note: "Temporary password used once and discarded" });
  db.session = u.id;
  return ok(meDto(db, u));
});

// ---------- admin (accounts and audit log) ----------
const adminOnly = (db: MDb) => (me(db)?.role === "admin" ? null : fail(403, "FORBIDDEN", "Admins only."));
const userRow = (db: MDb, u: MockUser) => ({
  id: u.id, name: u.name, email: u.email, role: u.role, studentId: u.studentId ?? null,
  active: u.isActive && !adm(db).disabled.includes(u.id), tempPassword: !!adm(db).passwords[u.id],
});
on("GET", "/api/admin/users", (_p, _b, db) => adminOnly(db) ?? ok({ users: USERS.map((u) => userRow(db, u)) }));
on("POST", "/api/admin/users/:id/status", ([id], b, db) => {
  const no = adminOnly(db); if (no) return no;
  const u = USERS.find((x) => x.id === id);
  if (!u) return fail(404, "NOT_FOUND", "User not found.");
  if (u.id === db.session) return fail(409, "CONFLICT", "You can't disable your own account.");
  const reason = String(b.reason ?? "").trim();
  if (reason.length < 4) return fail(422, "VALIDATION", "Give a short reason; it is kept in the audit log.");
  const a = adm(db);
  a.disabled = b.active ? a.disabled.filter((x) => x !== id) : [...new Set([...a.disabled, id])];
  a.audit.push({ id: uid(), at: iso(Date.now()), by: me(db)!.email, action: b.active ? "Re-enabled account" : "Disabled account", target: u.email, note: reason });
  return ok(userRow(db, u));
});
on("POST", "/api/admin/users/:id/reset-password", ([id], _b, db) => {
  const no = adminOnly(db); if (no) return no;
  const u = USERS.find((x) => x.id === id);
  if (!u) return fail(404, "NOT_FOUND", "User not found.");
  if (u.id === db.session) return fail(409, "CONFLICT", "Use your own settings to change your password.");
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const temp = Array.from(crypto.getRandomValues(new Uint8Array(10)), (n) => alphabet[n % alphabet.length]).join("").replace(/(.{5})/, "$1-");
  adm(db).passwords[id] = temp; // the old password stops working immediately
  adm(db).audit.push({ id: uid(), at: iso(Date.now()), by: me(db)!.email, action: "Reset password", target: u.email, note: "Temporary password issued; old password no longer works" });
  return ok({ temporaryPassword: temp });
});
on("GET", "/api/admin/audit", (_p, _b, db) => {
  const no = adminOnly(db); if (no) return no;
  const ex = (id: string) => examById(id)?.title ?? "exam";
  const extensions = px(db).extensions.map((x) => ({ id: x.id, at: x.at, by: x.by, action: x.attemptId ? "Added time for one candidate" : "Added time for everyone", target: ex(x.examId), note: `+${x.minutes} min · ${x.reason}` }));
  const decisions = db.attempts.flatMap((a) => a.requests.filter((r) => r.decidedAt).map((r) => ({
    id: r.id, at: r.decidedAt!, by: r.decidedBy ?? "examiner", action: `${r.status === "approved" ? "Approved" : "Denied"} ${r.type === "unlock" ? "unlock" : "re-attempt"} request`,
    target: `${USERS.find((u) => u.id === a.userId)?.name ?? "candidate"} · ${ex(a.examId)}`, note: r.note ?? "",
  })));
  const closes = Object.entries(px(db).closedAt).map(([examId, at]) => ({ id: `close-${examId}`, at, by: "examiner", action: "Closed exam early", target: ex(examId), note: "Accepted answers submitted for everyone" }));
  const seeded = [
    { id: "seed-1", at: iso(db.epoch - 3 * 3600_000), by: "admin@exam.test", action: "Imported candidates", target: "24 accounts", note: "0 rows rejected" },
    { id: "seed-2", at: iso(db.epoch - 2 * 3600_000), by: "admin@exam.test", action: "Created account", target: "examiner2@exam.test", note: "Role: examiner" },
  ];
  const entries = [...adm(db).audit, ...extensions, ...decisions, ...closes, ...seeded].sort((x, y) => Date.parse(y.at) - Date.parse(x.at));
  return ok({ entries });
});
on("GET", "/api/auth/me", (_p, _b, db) => ok(meDto(db, me(db)!)));
on("PUT", "/api/me/preferences", (_p, b, db) => {
  const u = me(db)!;
  db.prefs[u.id] = { ...db.prefs[u.id], ...b };
  return ok({ ...DEFAULT_PREFERENCES, ...db.prefs[u.id] });
});

on("GET", "/api/me/exams/:id/result", ([id], _b, db) => {
  const u = me(db)!;
  const e = examById(id);
  if (!e || !e.enrolled.includes(u.id) || e.status !== "published") return fail(404, "NOT_FOUND", "Exam not found.");
  if (!e.resultsPublished) return fail(409, "RESULTS_NOT_PUBLISHED", "Results for this exam haven't been published yet.");
  const pct = PUBLISHED_SCORES[u.id] ?? null;
  return ok({
    examId: e.id, title: e.title, code: e.code, examinerName: userById(e.ownerId).name, candidateName: u.name, studentId: u.studentId ?? null,
    publishedAt: iso(closes(db, e)), totalMarks: e.totalMarks, questionCount: e.questions.length || STAT_Q1_QUESTION_COUNT,
    scorePct: pct, marks: pct === null ? null : Math.round((pct / 100) * e.totalMarks * 10) / 10,
  });
});
on("GET", "/api/me/exams", (_p, _b, db) => {
  const u = me(db)!;
  if (u.role !== "candidate") return fail(403, "FORBIDDEN", "Candidates only.");
  const now = Date.now();
  const cards = EXAMS.filter((e) => e.enrolled.includes(u.id) && e.status === "published").map((e) => candidateCard(db, e, u.id, now));
  const isAvail = (c: CandidateExamCard) => c.phase === "ongoing" && ["not_started", "in_progress", "locked", "reattempt_granted"].includes(c.status);
  const res: CandidateExamList = {
    serverNow: iso(now),
    available: cards.filter(isAvail),
    upcoming: cards.filter((c) => c.phase === "scheduled"),
    completed: cards.filter((c) => c.phase !== "scheduled" && !isAvail(c)),
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

// ---------- one-time identity check before a candidate's first start ----------
const idv = (db: MDb): Record<string, string> => ((db as MDb & { identity?: Record<string, string> }).identity ??= {});
on("POST", "/api/exams/:id/verify-identity", ([id], b, db) => {
  const u = me(db)!;
  if (u.role !== "candidate") return fail(403, "FORBIDDEN", "Candidates only.");
  const e = examById(id);
  if (!e || !e.enrolled.includes(u.id) || e.status !== "published") return fail(404, "NOT_FOUND", "Exam not found.");
  const A = adm(db);
  const pwOk = !A.passwords[u.id] && b.password === (A.custom![u.id] ?? DEMO_PASSWORD);
  const sidOk = String(b.studentId ?? "").trim().toUpperCase() === (u.studentId ?? "").toUpperCase();
  if (!pwOk || !sidOk) {
    A.audit.push({ id: uid(), at: iso(Date.now()), by: u.email, action: "Identity check did not match", target: `${e.title} (${e.code})`, note: "Student ID or password was wrong; no attempt started" });
    return fail(422, "VALIDATION", "Those details don't match this account. Check your student ID and password.");
  }
  const at = iso(Date.now());
  idv(db)[`${e.id}:${u.id}`] = at;
  A.audit.push({ id: uid(), at, by: u.email, action: "Identity verified", target: `${e.title} (${e.code})`, note: "Password and student ID confirmed before starting" });
  return ok({ verifiedAt: at });
});

on("POST", "/api/exams/:id/attempts", ([id], b, db) => {
  const u = me(db)!;
  const sid = String(b.clientSessionId ?? "");
  const e = examById(id);
  if (!e || !e.enrolled.includes(u.id) || e.status !== "published") return fail(404, "NOT_FOUND", "Exam not found.");
  const now = Date.now();
  const ph = phase(db, e, now);
  if (ph === "scheduled") return fail(403, "EXAM_NOT_OPEN", "This exam hasn't opened yet.");
  if (ph !== "ongoing") return fail(403, "EXAM_CLOSED", "This exam has closed.");
  const existing = db.attempts.find((x) => x.examId === e.id && x.userId === u.id && !x.isSandbox && x.status !== "voided");
  // a first start needs the one-time identity check; resuming an attempt already tied to this person does not
  if (!existing && u.role === "candidate" && !idv(db)[`${e.id}:${u.id}`]) return fail(403, "FORBIDDEN", "Verify your identity before starting this exam.");
  if (existing) {
    if (existing.status === "submitted" || existing.status === "expired") return fail(409, "ALREADY_SUBMITTED", "You have already submitted this exam.");
    if (!existing.sessions.some((s) => s.id === sid)) {
      existing.sessions.push({ id: sid, openedAt: iso(now), ua: navigator.userAgent });
      const max = e.settings.maxOpens + existing.extraOpens;
      serverEvent(existing, "session_opened", { open: existing.sessions.length, max });
      if (existing.sessions.length > max) existing.status = "locked";
    } else if (existing.activeSession !== sid) {
      serverEvent(existing, "session_superseded");
    }
    existing.activeSession = sid;
    existing.lastSeenAt = iso(now);
    return ok(attemptState(db, existing, sid));
  }
  delete db.reattemptGranted[`${e.id}:${u.id}`];
  const a = createAttempt(db, e, u.id, now, sid);
  return ok(attemptState(db, a, sid), 201);
});

function ownAttempt(db: MDb, id: string) {
  const u = me(db)!;
  return db.attempts.find((x) => x.id === id && x.userId === u.id) ?? null;
}

on("GET", "/api/attempts/:id", ([id], _b, db) => {
  const a = ownAttempt(db, id);
  if (!a) return fail(404, "NOT_FOUND", "Attempt not found.");
  const sid = sessionStorage.getItem(`exam:session:${id}`) ?? undefined;
  return ok(attemptState(db, a, sid));
});

on("PUT", "/api/attempts/:id/answers/:aq", ([id, aq], b, db) => {
  const a = ownAttempt(db, id);
  if (!a || !a.answers[aq]) return fail(404, "NOT_FOUND", "Question not found.");
  if (a.activeSession !== b.clientSessionId) return fail(409, "SESSION_SUPERSEDED", "This exam is open in another window.");
  if (a.status === "locked") return fail(423, "ATTEMPT_LOCKED", "This attempt is locked.");
  if (a.status !== "in_progress" || Date.now() > Date.parse(a.deadline) + GRACE_MS) return fail(409, "ATTEMPT_CLOSED", "Time is up. This change was not accepted.");
  a.lastSeenAt = iso(Date.now());
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
  a.lastSeenAt = iso(Date.now());
  const req = latestReq(a);
  const res: HeartbeatResponse = {
    serverNow: iso(Date.now()), deadline: a.deadline, status: a.status, activeSession: a.activeSession === b.clientSessionId,
    announcements: db.announcements.filter((x) => x.examId === a.examId),
    pendingRequest: req ? { id: req.id, type: req.type, status: req.status, note: req.note } : null,
  };
  return ok(res);
});

on("POST", "/api/attempts/:id/events", ([id], b, db) => {
  const a = ownAttempt(db, id);
  if (!a) return fail(404, "NOT_FOUND", "Attempt not found.");
  if (a.status !== "in_progress" || a.activeSession !== b.clientSessionId) return ok({ accepted: 0 }); // BR-18: active session of a live attempt only
  const seen = new Set(a.events.map((x) => x.id));
  const now = iso(Date.now());
  let accepted = 0;
  for (const raw of ((b.events as Record<string, unknown>[]) ?? []).slice(0, 200)) {
    const ev = raw as { clientEventId: string; clientSeq: number; type: StoredObservation["type"]; clientTime: string; detail?: Record<string, unknown> };
    if (seen.has(ev.clientEventId) || a.events.length >= 2000) continue;
    a.events.push({ id: ev.clientEventId, clientSeq: ev.clientSeq + 10000 * a.sessions.findIndex((s) => s.id === b.clientSessionId), type: ev.type, clientTime: ev.clientTime, serverTime: now, detail: ev.detail });
    accepted++;
  }
  a.lastSeenAt = now;
  return ok({ accepted });
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
  if (pendingReq(a)) return fail(409, "REQUEST_NOT_ALLOWED", "You already have a pending request.");
  const type = b.type as "unlock" | "reattempt";
  if (type === "unlock" && a.status !== "locked") return fail(409, "REQUEST_NOT_ALLOWED", "This attempt isn't locked.");
  if (type === "reattempt" && !a.receipt?.canRequestReattempt) return fail(409, "REQUEST_NOT_ALLOWED", "A re-attempt can't be requested for this exam.");
  const reason = String(b.reason ?? "").trim();
  if (reason.length < 10) return fail(422, "VALIDATION", "Please describe what happened.", { fields: { reason: "At least 10 characters" } });
  const r: MRequest = { id: uid(), type, status: "pending", reasonCategory: (b.reasonCategory as MRequest["reasonCategory"]) ?? "other", reason, createdAt: iso(Date.now()), decidedAt: null, decidedBy: null, note: null };
  a.requests.push(r);
  return ok({ id: r.id, type: r.type, status: r.status, note: null }, 201);
});

// ---------- examiner ----------
// ---------- authoring: create an exam (draft or published) with enrolment ----------
on("GET", "/api/candidates", (_p, _b, db) => {
  const u = me(db)!;
  if (u.role === "candidate") return fail(403, "FORBIDDEN", "Examiners only.");
  return ok({ candidates: USERS.filter((x) => x.role === "candidate" && x.isActive && !adm(db).disabled.includes(x.id)).map((x) => ({ id: x.id, name: x.name, email: x.email, studentId: x.studentId ?? null })) });
});
on("POST", "/api/exams", (_p, b, db) => {
  const u = me(db)!;
  if (u.role === "candidate") return fail(403, "FORBIDDEN", "Examiners only.");
  type QIn = { type: "single" | "multi" | "written"; topic: string; prompt: string; marks: number; options?: string[]; correct?: number[]; multiRule?: "exact" | "partial" };
  const title = String(b.title ?? "").trim(); const code = String(b.code ?? "").trim().toUpperCase();
  const qs = (Array.isArray(b.questions) ? b.questions : []) as QIn[];
  const durationMin = Number(b.durationMin); const opensInMin = Number(b.opensInMin ?? 0); const openForMin = Number(b.openForMin ?? 1440);
  if (title.length < 3 || code.length < 2 || !(durationMin >= 1) || !(openForMin >= durationMin)) return fail(422, "VALIDATION", "Check the title, code, duration and window.");
  const draftId = typeof b.draftId === "string" ? b.draftId : null;
  if (EXAMS.some((e) => e.code === code && e.id !== draftId)) return fail(409, "CONFLICT", `The code ${code} is already used by another exam.`, { fields: { code: "Already used" } });
  if (b.publish && qs.length === 0) return fail(422, "VALIDATION", "Add at least one question before publishing.");
  const questions: MockQuestion[] = qs.map((q) => {
    const options = q.type === "written" ? undefined : (q.options ?? []).map((label) => ({ id: uid(), label: String(label) }));
    return {
      id: uid(), type: q.type, topic: String(q.topic || "General"), prompt: String(q.prompt), marks: Math.max(1, Number(q.marks) || 1),
      options, key: options ? (q.correct ?? []).map((i) => options[i]?.id).filter(Boolean) as string[] : undefined,
      multiRule: q.type === "multi" ? (q.multiRule === "partial" ? "partial" : "exact") : undefined,
    };
  });
  const sinceEpoch = (Date.now() - db.epoch) / 60000;
  const e: MockExam = {
    id: uid(), code, title, ownerId: u.id, status: b.publish ? "published" : "draft",
    opensOffsetMin: sinceEpoch + Math.max(0, opensInMin) - 0.05, closesOffsetMin: sinceEpoch + Math.max(0, opensInMin) + openForMin,
    durationMin, totalMarks: questions.reduce((s, q) => s + q.marks, 0), instructions: String(b.instructions ?? "").trim() || "Answer every question. The timer is kept by the server.",
    settings: {
      shuffleQuestions: false, shuffleOptions: true, pastePolicy: b.pastePolicy === "allow" || b.pastePolicy === "log" ? b.pastePolicy : "block",
      fullscreenRequired: !!b.fullscreenRequired, allowMobile: true, maxOpens: 3, maxReattempts: 1, showBreakdown: true, cameraCheck: b.cameraCheck === "presence" ? "presence" : "off",
    },
    questions, enrolled: (Array.isArray(b.enrolled) ? b.enrolled : []).map(String).filter((id: string) => USERS.some((x) => x.id === id && x.role === "candidate")),
    resultsPublished: false,
  };
  const store = db as MDb & { customExams?: MockExam[] };
  store.customExams ??= [];
  const prev = draftId ? store.customExams.findIndex((x) => x.id === draftId && x.status === "draft" && (u.role === "admin" || x.ownerId === u.id)) : -1;
  if (prev >= 0) { e.id = draftId!; store.customExams[prev] = e; } else store.customExams.push(e);
  mergeCustomExams(db);
  adm(db).audit.push({ id: uid(), at: iso(Date.now()), by: u.email, action: b.publish ? "Published exam" : "Saved exam draft", target: `${title} (${code})`, note: `${questions.length} questions · ${e.enrolled.length} enrolled` });
  return ok({ examId: e.id, status: e.status }, 201);
});

on("GET", "/api/exams/:id/draft", ([id], _b, db) => {
  const u = me(db)!;
  const e = ((db as MDb & { customExams?: MockExam[] }).customExams ?? []).find((x) => x.id === id && x.status === "draft" && (u.role === "admin" || x.ownerId === u.id));
  if (!e) return fail(404, "NOT_FOUND", "Draft not found.");
  return ok({
    title: e.title, code: e.code, durationMin: e.durationMin, openForMin: Math.round(e.closesOffsetMin - e.opensOffsetMin), instructions: e.instructions,
    pastePolicy: e.settings.pastePolicy, fullscreenRequired: e.settings.fullscreenRequired, enrolled: e.enrolled,
    questions: e.questions.map((q) => ({ type: q.type, topic: q.topic, prompt: q.prompt, marks: q.marks, options: (q.options ?? []).map((o) => o.label), correct: (q.options ?? []).flatMap((o, i) => ((q.key ?? []).includes(o.id) ? [i] : [])), multiRule: q.multiRule ?? "exact" })),
  });
});

on("POST", "/api/exams/:id/publish", ([id], _b, db) => {
  const u = me(db)!;
  const store = (db as MDb & { customExams?: MockExam[] }).customExams ?? [];
  const e = store.find((x) => x.id === id && (u.role === "admin" || x.ownerId === u.id));
  if (!e) return fail(404, "NOT_FOUND", "Draft not found.");
  if (e.status === "published") return ok({ examId: e.id, status: e.status });
  const problems: string[] = [];
  if (!e.questions.length) problems.push("Add at least one question.");
  e.questions.forEach((q, i) => {
    if (q.prompt.trim().length < 5) problems.push(`Question ${i + 1}: write the question.`);
    if (q.type !== "written" && ((q.options ?? []).filter((o) => o.label.trim()).length < 2 || !(q.key ?? []).length)) problems.push(`Question ${i + 1}: needs two options and a correct answer.`);
  });
  if (!e.enrolled.length) problems.push("Enrol at least one candidate.");
  if (problems.length) return fail(422, "VALIDATION", problems.join(" "), { details: problems });
  e.status = "published";
  // the window starts from publication if it would otherwise already be over
  const sinceEpoch = (Date.now() - db.epoch) / 60000;
  if (e.closesOffsetMin < sinceEpoch + e.durationMin) { const len = Math.max(e.durationMin, e.closesOffsetMin - e.opensOffsetMin); e.opensOffsetMin = sinceEpoch - 0.05; e.closesOffsetMin = sinceEpoch + len; }
  mergeCustomExams(db);
  adm(db).audit.push({ id: uid(), at: iso(Date.now()), by: u.email, action: "Published exam", target: `${e.title} (${e.code})`, note: `${e.questions.length} questions · ${e.enrolled.length} enrolled` });
  return ok({ examId: e.id, status: e.status });
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
        enrolled: isStat ? 24 : e.enrolled.length, inProgress: at.filter((x) => x.status === "in_progress" || x.status === "locked").length,
        submitted: isStat ? 24 : at.filter((x) => x.status === "submitted" || x.status === "expired").length,
        awaitingGrading: at.filter((x) => (x.status === "submitted" || x.status === "expired") && e.questions.some((q) => q.type === "written")).length,
        pendingRequests: at.filter((x) => pendingReq(x)).length,
        priorityIncidents: isStat ? 1 : at.reduce((s, x) => s + incidentsOf(db, x).filter((i) => i.severity === "priority" && !i.review).length, 0),
      };
    }),
  };
  return ok(res);
});

on("GET", "/api/exams/:id/monitor", ([id], _b, db) => {
  const e = examOwned(db, id);
  if (!e) return fail(404, "NOT_FOUND", "Exam not found.");
  const now = Date.now();
  tickSimulation(db, now);
  const rows: MonitorRow[] = e.enrolled.map((cid) => {
    const u = userById(cid);
    const a = db.attempts.find((x) => x.examId === e.id && x.userId === cid && !x.isSandbox && x.status !== "voided");
    if (!a) {
      return {
        enrollmentId: `${e.id}:${cid}`, candidateId: cid, candidateName: u.name, studentId: u.studentId ?? null, attemptId: null,
        status: "not_started", answered: 0, total: e.questions.length, startedAt: null, deadline: null, finalizedAt: null,
        lastContactAt: null, contact: "none", opensUsed: 0, maxOpens: e.settings.maxOpens,
        incidents: { info: 0, review: 0, priority: 0 }, unreviewed: 0, pendingRequest: null,
      };
    }
    const inc = incidentsOf(db, a);
    const pr = pendingReq(a);
    return {
      enrollmentId: `${e.id}:${cid}`, candidateId: cid, candidateName: u.name, studentId: u.studentId ?? null, attemptId: a.id,
      status: a.status as MonitorRow["status"], answered: answeredCount(a), total: a.order.length, startedAt: a.startedAt, deadline: a.deadline,
      finalizedAt: a.receipt?.finalizedAt ?? null, lastContactAt: a.lastSeenAt, contact: contactOf(a, now),
      opensUsed: a.sessions.length, maxOpens: e.settings.maxOpens + a.extraOpens, incidents: countBySeverity(inc),
      unreviewed: inc.filter((i) => i.severity !== "info" && !i.review).length,
      pendingRequest: pr ? { id: pr.id, type: pr.type } : null,
    };
  });
  const count = (s: MonitorRow["status"]) => rows.filter((r) => r.status === s).length;
  const res: ExamMonitor = {
    serverNow: iso(now),
    exam: { examId: e.id, title: e.title, code: e.code, phase: phase(db, e, now), opensAt: iso(opens(db, e)), closesAt: iso(closes(db, e)), durationMin: e.durationMin, questionCount: e.questions.length },
    totals: { enrolled: rows.length, notStarted: count("not_started"), inProgress: count("in_progress"), locked: count("locked"), submitted: count("submitted"), expired: count("expired") },
    rows,
    announcements: db.announcements.filter((x) => x.examId === e.id),
    pendingRequests: rows.filter((r) => r.pendingRequest).length,
  };
  return ok(res);
});

on("POST", "/api/exams/:id/announcements", ([id], b, db) => {
  const e = examOwned(db, id);
  if (!e) return fail(404, "NOT_FOUND", "Exam not found.");
  const body = String(b.body ?? "").trim();
  if (!body || body.length > 500) return fail(422, "VALIDATION", "Announcement must be 1–500 characters.", { fields: { body: "1–500 characters" } });
  const a = { id: uid(), examId: e.id, body, createdAt: iso(Date.now()) };
  db.announcements.push(a);
  return ok(a, 201);
});

function examinerAttempt(db: MDb, id: string) {
  const a = db.attempts.find((x) => x.id === id);
  if (!a || !examOwned(db, a.examId)) return null;
  return a;
}

on("GET", "/api/attempts/:id/incidents", ([id], _b, db) => {
  const a = examinerAttempt(db, id);
  if (!a) return fail(404, "NOT_FOUND", "Attempt not found.");
  const e = examById(a.examId)!;
  const u = userById(a.userId);
  const res: AttemptTimeline = {
    serverNow: iso(Date.now()),
    attempt: {
      attemptId: a.id, examId: e.id, examTitle: e.title, candidateName: u.name, studentId: u.studentId ?? null, status: a.status,
      startedAt: a.startedAt, deadline: a.deadline, finalizedAt: a.receipt?.finalizedAt ?? null,
      answered: answeredCount(a), total: a.order.length, lastContactAt: a.lastSeenAt,
    },
    sessions: a.sessions.map((s) => ({ openedAt: s.openedAt, userAgent: s.ua, active: s.id === a.activeSession })),
    maxOpens: e.settings.maxOpens + a.extraOpens,
    incidents: incidentsOf(db, a),
  };
  return ok(res);
});

on("PUT", "/api/attempts/:id/incidents/:key/review", ([id, key], b, db) => {
  const a = examinerAttempt(db, id);
  const k = decodeURIComponent(key);
  if (!a || !incidentsOf(db, a).some((i) => i.key === k)) return fail(404, "NOT_FOUND", "Incident not found.");
  const decision = b.decision === "follow_up" ? "follow_up" : b.decision === "dismissed" ? "dismissed" : null;
  if (!decision) return fail(422, "VALIDATION", "Choose dismiss or follow-up.");
  const note = String(b.note ?? "").trim().slice(0, 500);
  db.reviews[k] = { decision, note, reviewer: me(db)!.name, reviewedAt: iso(Date.now()) };
  return ok(db.reviews[k]);
});

on("GET", "/api/exams/:id/requests", ([id], _b, db) => {
  const e = examOwned(db, id);
  if (!e) return fail(404, "NOT_FOUND", "Exam not found.");
  const list: ExamRequest[] = db.attempts
    .filter((a) => a.examId === e.id && !a.isSandbox)
    .flatMap((a) => a.requests.map((r) => {
      const inc = incidentsOf(db, a).filter((i) => i.category === "connectivity");
      return {
        id: r.id, attemptId: a.id, candidateName: userById(a.userId).name, type: r.type, reasonCategory: r.reasonCategory, reason: r.reason,
        status: r.status, createdAt: r.createdAt, decidedAt: r.decidedAt, decidedBy: r.decidedBy, decisionNote: r.note,
        attemptStatus: a.status, opensUsed: a.sessions.length, connectivityIncidents: inc.length,
        offlineSeconds: inc.reduce((s, i) => s + (i.durationSec ?? 0), 0),
      };
    }))
    .sort((x, y) => (x.status === "pending" ? 0 : 1) - (y.status === "pending" ? 0 : 1) || Date.parse(y.createdAt) - Date.parse(x.createdAt));
  return ok({ requests: list });
});

on("POST", "/api/requests/:id/decision", ([id], b, db) => {
  const a = db.attempts.find((x) => x.requests.some((r) => r.id === id));
  if (!a || !examOwned(db, a.examId)) return fail(404, "NOT_FOUND", "Request not found.");
  const r = a.requests.find((x) => x.id === id)!;
  if (r.status !== "pending") return fail(409, "REQUEST_NOT_ALLOWED", "This request was already decided.");
  const note = String(b.note ?? "").trim();
  if (note.length < 3) return fail(422, "VALIDATION", "Add a short note for the record.", { fields: { note: "At least 3 characters" } });
  const approve = b.decision === "approve";
  if (approve && r.type === "unlock") {
    if (a.status !== "locked") return fail(409, "REQUEST_NOT_ALLOWED", "This attempt is no longer locked.");
    a.status = "in_progress"; a.extraOpens += 1;
  }
  if (approve && r.type === "reattempt") {
    const e = examById(a.examId)!;
    if (phase(db, e, Date.now()) !== "ongoing") return fail(409, "REQUEST_NOT_ALLOWED", "The exam window has closed.");
    a.status = "voided"; db.reattemptGranted[`${a.examId}:${a.userId}`] = true;
  }
  Object.assign(r, { status: approve ? "approved" : "denied", decidedAt: iso(Date.now()), decidedBy: me(db)!.name, note });
  return ok({ id: r.id, status: r.status });
});

// ---------- proctoring additions (guide features) ----------
const MINUTES = (v: unknown) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 1 && n <= 60 ? n : null; };

on("GET", "/api/ping", () => ok({ serverNow: iso(Date.now()) }));

on("GET", "/api/exams/:id/proctor", ([id], _b, db) => {
  const e = examOwned(db, id);
  if (!e) return fail(404, "NOT_FOUND", "Exam not found.");
  const P = px(db);
  const attempts = db.attempts.filter((a) => a.examId === e.id && !a.isSandbox && a.status !== "voided");
  const started = new Set(attempts.map((a) => a.userId));
  const anns = db.announcements.filter((x) => x.examId === e.id);
  return ok({
    serverNow: iso(Date.now()),
    instructions: e.instructions,
    notes: P.notes[e.id] ?? "",
    closedAt: P.closedAt[e.id] ?? null,
    messages: P.messages.filter((m) => m.examId === e.id),
    extensions: P.extensions.filter((x) => x.examId === e.id),
    acks: Object.fromEntries(anns.map((a) => {
      const acked = new Set(P.acks[a.id] ?? []);
      const audience = e.enrolled.filter((u) => started.has(u));
      return [a.id, { acked: audience.filter((u) => acked.has(u)).length, total: audience.length, missing: audience.filter((u) => !acked.has(u)).map((u) => userById(u).name) }];
    })),
  });
});

on("POST", "/api/attempts/:id/messages", ([id], b, db) => {
  const a = examinerAttempt(db, id);
  if (!a) return fail(404, "NOT_FOUND", "Attempt not found.");
  const body = String(b.body ?? "").trim();
  if (body.length < 1 || body.length > 500) return fail(422, "VALIDATION", "Write a message (up to 500 characters).", { fields: { body: "1–500 characters" } });
  const kind = b.kind === "reminder" ? "reminder" : "message";
  const now = iso(Date.now());
  const P = px(db);
  // a reply (or a reminder) never closes a help request on its own; the examiner resolves each one explicitly
  const m: MMessage = { id: uid(), examId: a.examId, attemptId: a.id, from: "examiner", kind, category: null, body, createdAt: now, by: me(db)!.name, resolvedAt: null };
  P.messages.push(m);
  return ok(m, 201);
});

on("POST", "/api/attempts/:id/help/:msgId/resolve", ([id, msgId], _b, db) => {
  const a = examinerAttempt(db, id);
  if (!a) return fail(404, "NOT_FOUND", "Attempt not found.");
  const m = px(db).messages.find((x) => x.id === msgId && x.attemptId === a.id && x.kind === "help");
  if (!m) return fail(404, "NOT_FOUND", "Help request not found.");
  m.resolvedAt ??= iso(Date.now());
  return ok(m);
});

function extend(db: MDb, a: MAttempt, minutes: number) {
  a.deadline = iso(Date.parse(a.deadline) + minutes * 60000);
}

on("POST", "/api/attempts/:id/extend", ([id], b, db) => {
  const a = examinerAttempt(db, id);
  if (!a) return fail(404, "NOT_FOUND", "Attempt not found.");
  const minutes = MINUTES(b.minutes);
  const reason = String(b.reason ?? "").trim();
  if (!minutes) return fail(422, "VALIDATION", "Choose between 1 and 60 minutes.", { fields: { minutes: "1–60" } });
  if (reason.length < 5) return fail(422, "VALIDATION", "Add a reason for the record.", { fields: { reason: "At least 5 characters" } });
  if (a.status !== "in_progress" && a.status !== "locked") return fail(409, "ATTEMPT_CLOSED", "This attempt has already ended.");
  extend(db, a, minutes);
  const P = px(db); const by = me(db)!.name; const now = iso(Date.now());
  P.extensions.push({ id: uid(), examId: a.examId, attemptId: a.id, minutes, reason, by, at: now, affected: 1 });
  P.messages.push({ id: uid(), examId: a.examId, attemptId: a.id, from: "examiner", kind: "message", category: null, body: `Your examiner added ${minutes} min to your time.`, createdAt: now, by, resolvedAt: null });
  return ok({ deadline: a.deadline });
});

on("POST", "/api/exams/:id/extend", ([id], b, db) => {
  const e = examOwned(db, id);
  if (!e) return fail(404, "NOT_FOUND", "Exam not found.");
  const minutes = MINUTES(b.minutes);
  const reason = String(b.reason ?? "").trim();
  if (!minutes) return fail(422, "VALIDATION", "Choose between 1 and 60 minutes.", { fields: { minutes: "1–60" } });
  if (reason.length < 5) return fail(422, "VALIDATION", "Add a reason for the record.", { fields: { reason: "At least 5 characters" } });
  const live = db.attempts.filter((a) => a.examId === e.id && !a.isSandbox && (a.status === "in_progress" || a.status === "locked"));
  live.forEach((a) => extend(db, a, minutes));
  const P = px(db); const by = me(db)!.name; const now = iso(Date.now());
  P.extensions.push({ id: uid(), examId: e.id, attemptId: null, minutes, reason, by, at: now, affected: live.length });
  db.announcements.push({ id: uid(), examId: e.id, body: `Everyone has ${minutes} more minutes. Reason: ${reason}`, createdAt: now });
  return ok({ affected: live.length });
});

on("POST", "/api/exams/:id/close", ([id], b, db) => {
  const e = examOwned(db, id);
  if (!e) return fail(404, "NOT_FOUND", "Exam not found.");
  const reason = String(b.reason ?? "").trim();
  if (reason.length < 5) return fail(422, "VALIDATION", "Add a reason for the record.", { fields: { reason: "At least 5 characters" } });
  const now = Date.now();
  px(db).closedAt[e.id] = iso(now);
  const live = db.attempts.filter((a) => a.examId === e.id && (a.status === "in_progress" || a.status === "locked"));
  live.forEach((a) => finalize(db, a, "examiner_close"));
  db.announcements.push({ id: uid(), examId: e.id, body: `The examiner closed this exam. Your accepted answers were submitted. Reason: ${reason}`, createdAt: iso(now) });
  return ok({ finalized: live.length });
});

on("PUT", "/api/exams/:id/notes", ([id], b, db) => {
  const e = examOwned(db, id);
  if (!e) return fail(404, "NOT_FOUND", "Exam not found.");
  const notes = String(b.notes ?? "").slice(0, 2000);
  px(db).notes[e.id] = notes;
  return ok({ notes });
});

on("POST", "/api/issues", (_p, b, db) => {
  const u = me(db)!;
  const body = String(b.body ?? "").trim();
  if (body.length < 10) return fail(422, "VALIDATION", "Describe the issue in a sentence or two.", { fields: { body: "At least 10 characters" } });
  const issue = { id: uid(), examId: typeof b.examId === "string" ? b.examId : null, category: String(b.category ?? "other"), body: body.slice(0, 1000), by: u.name, role: u.role, at: iso(Date.now()) };
  px(db).issues.push(issue);
  return ok(issue, 201);
});

on("GET", "/api/issues", (_p, _b, db) => {
  const u = me(db)!;
  if (u.role === "candidate") return fail(403, "FORBIDDEN", "Staff only.");
  const list = px(db).issues.filter((i) => u.role === "admin" || i.by === u.name);
  return ok({ issues: [...list].reverse() });
});

// candidate side
on("GET", "/api/attempts/:id/inbox", ([id], _b, db) => {
  const a = ownAttempt(db, id);
  if (!a) return fail(404, "NOT_FOUND", "Attempt not found.");
  const P = px(db);
  const u = me(db)!;
  return ok({
    messages: P.messages.filter((m) => m.attemptId === a.id),
    acked: db.announcements.filter((x) => x.examId === a.examId && (P.acks[x.id] ?? []).includes(u.id)).map((x) => x.id),
  });
});

on("POST", "/api/attempts/:id/help", ([id], b, db) => {
  const a = ownAttempt(db, id);
  if (!a) return fail(404, "NOT_FOUND", "Attempt not found.");
  if (a.status !== "in_progress" && a.status !== "locked") return fail(409, "ATTEMPT_CLOSED", "This attempt has ended.");
  const body = String(b.body ?? "").trim();
  if (body.length < 3 || body.length > 500) return fail(422, "VALIDATION", "Tell your examiner what you need (3–500 characters).", { fields: { body: "3–500 characters" } });
  const category = b.category === "technical" || b.category === "break" ? b.category : "question";
  const P = px(db);
  if (P.messages.filter((m) => m.attemptId === a.id && m.kind === "help" && !m.resolvedAt).length >= 3) return fail(429, "RATE_LIMITED", "You already have open requests. Your examiner will reply.");
  const m: MMessage = { id: uid(), examId: a.examId, attemptId: a.id, from: "candidate", kind: "help", category, body, createdAt: iso(Date.now()), by: me(db)!.name, resolvedAt: null };
  P.messages.push(m);
  a.lastSeenAt = m.createdAt;
  return ok(m, 201);
});

on("POST", "/api/attempts/:id/announcements/:ann/ack", ([id, ann], _b, db) => {
  const a = ownAttempt(db, id);
  if (!a || !db.announcements.some((x) => x.id === ann && x.examId === a.examId)) return fail(404, "NOT_FOUND", "Announcement not found.");
  const P = px(db); const u = me(db)!.id;
  P.acks[ann] = Array.from(new Set([...(P.acks[ann] ?? []), u]));
  return ok({ ok: true });
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
    if (!url.startsWith("/api/auth/login") && !url.startsWith("/api/auth/complete-reset") && !me(db)) { save(db); return fail(401, "UNAUTHENTICATED", "Please sign in."); }
    const res = h(match.slice(1).map(decodeURIComponent), (body ?? {}) as Record<string, unknown>, db);
    save(db);
    return JSON.parse(JSON.stringify(res));
  }
  return fail(404, "NOT_FOUND", `No mock for ${method} ${url}`);
}

if (typeof window !== "undefined") {
  (window as unknown as { __mock: object }).__mock = {
    reset: () => { localStorage.removeItem(KEY); localStorage.removeItem("mock:db:v1"); location.reload(); },
    approveLatestRequest: () => {
      const db = load();
      const a = [...db.attempts].reverse().find((x) => pendingReq(x));
      const r = a && pendingReq(a);
      if (!a || !r) return "no pending request";
      Object.assign(r, { status: "approved", decidedAt: iso(Date.now()), decidedBy: "Examiner (console)", note: "Approved (mock)." });
      if (r.type === "unlock") { a.status = "in_progress"; a.extraOpens += 1; }
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
