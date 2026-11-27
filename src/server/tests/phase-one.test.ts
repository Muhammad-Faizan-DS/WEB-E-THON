import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { hash } from "bcryptjs";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectDatabase } from "../database";
import { users } from "../../../db/schema";

const require = createRequire(import.meta.url);
const password = randomBytes(20).toString("hex");
const cronSecret = randomBytes(32).toString("hex");
let engine: PGlite | undefined;
let socket: PGLiteSocketServer | undefined;
let app: ChildProcess | undefined;
let base: string;
let logs = "";
let identities: Record<string, string>;

async function freePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No local test port.");
  const { port } = address;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

beforeAll(async () => {
  engine = await PGlite.create();
  socket = new PGLiteSocketServer({ db: engine, port: 0, host: "127.0.0.1", maxConnections: 5 });
  await socket.start();
  const databaseUrl = `postgresql://test:test@${socket.getServerConn()}/postgres`;
  const { db, pool } = connectDatabase(databaseUrl);
  try {
    await migrate(db, { migrationsFolder: "db/migrations" });
    const passwordHash = await hash(password, 4);
    const accounts = await db.insert(users).values([
      { role: "admin", name: "Administrator", email: "admin@example.test", passwordHash },
      { role: "examiner", name: "Examiner", email: "examiner@example.test", passwordHash },
      { role: "examiner", name: "Other examiner", email: "examiner2@example.test", passwordHash },
      { role: "candidate", name: "Candidate", email: "candidate@example.test", passwordHash },
      { role: "candidate", name: "Other candidate", email: "candidate2@example.test", passwordHash },
    ]).returning({ email: users.email, id: users.id });
    identities = Object.fromEntries(accounts.map(({ email, id }) => [email.split("@")[0], id]));
  } finally {
    await pool.end();
  }

  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  app = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
    env: { ...process.env, NODE_ENV: "development", NEXT_TELEMETRY_DISABLED: "1", DATABASE_URL: databaseUrl,
      AUTH_SECRET: randomBytes(32).toString("hex"), AUTH_URL: base, CRON_SECRET: cronSecret },
    windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
  });
  app.stdout?.on("data", (data) => { logs = (logs + String(data)).slice(-8_000); });
  app.stderr?.on("data", (data) => { logs = (logs + String(data)).slice(-8_000); });
  for (let i = 0; i < 100; i++) {
    if (app.exitCode !== null) break;
    const response = await fetch(`${base}/api/auth/csrf`).catch(() => null);
    if (response?.ok) return;
    await delay(150);
  }
  throw new Error(`Next.js test server did not start.\n${logs}`);
}, 60_000);

afterAll(async () => {
  if (app && app.exitCode === null) {
    const exited = once(app, "exit");
    app.kill();
    await exited;
  }
  await socket?.stop();
  await engine?.close();
});

function cookies(response: Response) {
  return response.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; ");
}

async function login(account: string) {
  const csrf = await fetch(`${base}/api/auth/csrf`);
  const { csrfToken } = await csrf.json();
  const response = await fetch(`${base}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { cookie: cookies(csrf), "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ csrfToken, email: `${account}@example.test`, password }),
    redirect: "manual",
  });
  const cookie = cookies(response);
  expect(cookie).toMatch(/authjs\.session-token=/);
  return cookie;
}

async function request(path: string, options: { cookie?: string; method?: string; data?: object; headers?: Record<string, string> } = {}) {
  const { cookie, method = "GET", data, headers } = options;
  const response = await fetch(base + path, {
    method,
    headers: { ...(cookie ? { cookie } : {}), ...(data === undefined ? {} : { "content-type": "application/json" }), ...headers },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  return { status: response.status, ...(await response.json()) };
}

function expectCode(response: object, status: number, code: string) {
  expect(response).toMatchObject({ status, error: { code } });
}


async function activate(examiner: string, fields: object) {
  const now = Date.now();
  const made = await request("/api/exams", { cookie: examiner, method: "POST", data: {
    startsAt: new Date(now - 30_000).toISOString(), endsAt: new Date(now + 600_000).toISOString(), durationMin: 5, ...fields,
  } });
  expect(made.status, JSON.stringify(made)).toBe(201);
  const examId = made.data.id;
  const exam = "/api/exams/" + examId;
  expect((await request(exam + "/publish", { cookie: examiner, method: "POST" })).status).toBe(200);
  const enrolled = await request(exam + "/enrollments", { cookie: examiner, method: "POST", data: { candidates: [{ candidateId: identities.candidate2 }] } });
  expect(enrolled.status).toBe(200);
  const enrollmentId = enrolled.data[0].id;
  const keys = await request(exam + "/keys", { cookie: examiner, method: "POST", data: { enrollmentIds: [enrollmentId] } });
  expect(keys.status).toBe(201);
  return { exam, examId, enrollmentId, start: (candidate: string, key = keys.data[0].key) => request(exam + "/attempts", {
    cookie: candidate, method: "POST", data: { deviceCheck: true, key },
  }) };
}

describe("SecureExam HTTP API", () => {
  it("enforces ownership, key lockout, deadline, question release, saves and exactly-once submit", async ({ onTestFailed }) => {
    onTestFailed(() => { console.error(logs); });
    expectCode(await request("/api/exams"), 401, "UNAUTHENTICATED");
    const examiner = await login("examiner");
    const otherExaminer = await login("examiner2");
    const candidate = await login("candidate");
    const otherCandidate = await login("candidate2");
    expectCode(await request("/api/exams", { cookie: candidate }), 403, "FORBIDDEN");

    const question = {
      type: "single", text: "Which number is even?", topic: "Arithmetic", difficulty: 1, marks: 2,
      options: [{ id: "a", text: "2", isCorrect: true }, { id: "b", text: "3", isCorrect: false }],
    };
    const questionIds = [];
    for (const text of ["Which number is even?", "Select the even number."]) {
      const made = await request("/api/questions", { cookie: examiner, method: "POST", data: { ...question, text } });
      expect(made.status, JSON.stringify(made)).toBe(201);
      questionIds.push(made.data.id);
    }
    const now = Date.now();
    const endsAt = new Date(now + 120_000).toISOString();
    const { data: exam, status: createStatus } = await request("/api/exams", { cookie: examiner, method: "POST", data: {
      title: "Phase one integration", startsAt: new Date(now - 60_000).toISOString(), endsAt,
      durationMin: 30, totalMarks: 4, questionIds,
      settings: { openLimit: 1, sequentialReveal: true, blueprint: [{ topic: "Arithmetic", difficulty: 1, count: 2 }] },
    } });
    expect(createStatus).toBe(201);
    const e = `/api/exams/${exam.id}`;
    expectCode(await request(e + "/checklist", { cookie: otherExaminer }), 403, "FORBIDDEN");
    expect(await request(e + "/checklist", { cookie: examiner })).toMatchObject({ status: 200, data: { canPublish: true, issues: [] } });
    expect((await request(e + "/publish", { cookie: examiner, method: "POST" })).status).toBe(200);

    const enrollment = await request(e + "/enrollments", { cookie: examiner, method: "POST", data: {
      candidates: [{ candidateId: identities.candidate }, { candidateId: identities.candidate2 }],
    } });
    expect(enrollment.status).toBe(200);
    const ids: string[] = enrollment.data.map(({ id }: { id: string }) => id);
    expect(await request(`/api/exams?id=${exam.id}`, { cookie: examiner })).toMatchObject({
      status: 200, data: { questionIds: expect.arrayContaining(questionIds), enrollments: expect.arrayContaining([expect.objectContaining({ id: ids[0] })]) },
    });
    const keys = await request(e + "/keys", { cookie: examiner, method: "POST", data: { enrollmentIds: ids } });
    expect(keys.status, JSON.stringify(keys)).toBe(201);
    const start = (cookie: string, key: string, deviceCheck = true) =>
      request(e + "/attempts", { cookie, method: "POST", data: { deviceCheck, key } });

    expectCode(await start(candidate, keys.data[0].key, false), 403, "DESKTOP_REQUIRED");
    for (let i = 0; i < 5; i++) {
      expectCode(await start(otherCandidate, "incorrect"), 403, i === 4 ? "KEY_LOCKED" : "INVALID_KEY");
    }
    expectCode(await start(otherCandidate, keys.data[1].key), 403, "KEY_UNAVAILABLE");
    const started = await start(candidate, keys.data[0].key);
    expect(started, JSON.stringify(started)).toMatchObject({ status: 201, data: { deadlineAt: endsAt, totalQuestions: 2 } });
    expect(started.serverNow).toEqual(expect.any(String));
    expectCode(await start(candidate, keys.data[0].key), 409, "ATTEMPT_EXISTS");

    const a = `/api/attempts/${started.data.id}`;
    let sessionId: string = started.data.sessionId;
    const read = (path: string) => request(a + path, { cookie: candidate, headers: { "x-exam-session-id": sessionId } });
    const post = (path: string) => request(a + path, { cookie: candidate, method: "POST", data: { sessionId } });
    expectCode(await request(a, { cookie: otherCandidate }), 403, "FORBIDDEN");
    expectCode(await read("/questions/2"), 403, "QUESTION_UNAVAILABLE");
    expectCode(await post("/next"), 409, "OPEN_LIMIT_REACHED");

    const update = await request("/api/questions", { cookie: examiner, method: "PATCH",
      data: { id: questionIds[0], question: { ...question, text: "Edited in the bank after the attempt started." } } });
    expect(update.status).toBe(200);

    const current = await read("/questions/current");
    expect(current.status).toBe(200);
    expect(current.data.text).not.toContain("Edited in the bank");
    expect(JSON.stringify(current.data)).not.toMatch(/answerKey|isCorrect/);
    const qid: string = current.data.id;
    const save = (seq: number, response: string, token = sessionId) => request(a + "/answers", {
      cookie: candidate, method: "PUT", data: { sessionId: token, answers: [{ qid, seq, response }] },
    });
    expect((await save(2, "b")).status).toBe(200);
    expect((await save(1, "a")).status).toBe(200);
    expect(await read("/questions/current")).toMatchObject({ data: { seq: 2, response: "b" } });

    const resumed = await request(a + "/heartbeat", { cookie: candidate, method: "POST", data: { takeover: true, deviceCheck: true } });
    expect(resumed).toMatchObject({ status: 200, data: { deadlineAt: endsAt, sessionId: expect.any(String) } });
    const old = sessionId;
    sessionId = resumed.data.sessionId;
    expect(sessionId).not.toBe(old);
    expectCode(await save(3, "a", old), 409, "SESSION_SUPERSEDED");
    expect((await post(`/answers/${qid}/lock`)).status).toBe(200);
    expectCode(await save(3, "a"), 409, "QUESTION_LOCKED");
    expect((await post("/next")).status).toBe(200);
    const second = await read("/questions/2");
    expect(second).toMatchObject({ status: 200, data: { position: 2 } });
    expect(second.data.text).not.toContain("Edited in the bank");

    const submitted = await post("/submit");
    expect(submitted).toMatchObject({ status: 200, data: { status: "submitted", submittedAt: expect.any(String) } });
    expect(await post("/submit")).toMatchObject({ status: 200, data: { submittedAt: submitted.data.submittedAt } });
    expectCode(await request(e + "/unpublish", { cookie: examiner, method: "POST" }), 409, "EXAM_FROZEN");

    const reissued = await request(e + "/keys", { cookie: examiner, method: "POST", data: { enrollmentIds: [ids[1]] } });
    expect(reissued.status).toBe(201);
    const expiring = await start(otherCandidate, reissued.data[0].key);
    expect(expiring.status).toBe(201);
    await engine!.query("update attempts set deadline_at = now() - interval '1 minute' where id = $1", [expiring.data.id]);
    expectCode(await request("/api/cron/finalize"), 401, "UNAUTHENTICATED");
    expect(await request("/api/cron/finalize", { headers: { authorization: `Bearer ${cronSecret}` } })).toMatchObject({ status: 200, data: { finalized: 1 } });
    expect(await request(`/api/attempts/${expiring.data.id}`, { cookie: otherCandidate })).toMatchObject({ data: { status: "auto_submitted" } });

    await engine!.query("update users set active = false where id = $1", [identities.candidate]);
    expectCode(await request(a, { cookie: candidate }), 401, "UNAUTHENTICATED");
    await engine!.query("update users set active = true where id = $1", [identities.candidate]);
  }, 60_000);

  it("gates publication on written grading and incident review, then signs a candidate PDF", async ({ onTestFailed }) => {
    onTestFailed(() => { console.error(logs); });
    const examiner = await login("examiner");
    const admin = await login("admin");
    const candidate = await login("candidate2");
    const other = await login("candidate");
    const accounts = await request("/api/admin/users", { cookie: admin });
    expect(accounts.status).toBe(200);
    expect(JSON.stringify(accounts.data)).not.toContain("passwordHash");
    expectCode(await request("/api/admin/users", { cookie: examiner }), 403, "FORBIDDEN");
    const imported = await request("/api/questions/import", { cookie: examiner, method: "POST", data: {
      format: "json", content: JSON.stringify([
        { text: "Explain gravity.", topic: "Physics", type: "written", marks: 4, difficulty: 2 },
        { text: "Invalid row", type: "unsupported" },
      ]), commit: true,
    } });
    expect(imported).toMatchObject({ status: 200, data: { imported: 1, errors: [expect.objectContaining({ row: 2 })] } });
    const bank = await request("/api/questions", { cookie: examiner });
    const qid = bank.data.find((question: { text: string }) => question.text === "Explain gravity.").id;
    const fixture = await activate(examiner, { title: "Physics written assessment", questionIds: [qid],
      totalMarks: 4, settings: { integrityMode: "standard", blueprint: [{ topic: "Physics", difficulty: 2, count: 1 }] } });
    const started = await fixture.start(candidate);
    expect(started.status, JSON.stringify(started)).toBe(201);
    const { id: attemptId, sessionId } = started.data;
    const path = "/api/attempts/" + attemptId;
    const post = (route: string, data: object) => request(path + route, { cookie: candidate, method: "POST", data: { sessionId, ...data } });
    expect((await request(path + "/answers", { cookie: candidate, method: "PUT", data: { sessionId, answers: [{ qid, seq: 1, response: "It attracts objects with mass." }] } })).status).toBe(200);
    expect((await post("/events", { type: "paste_blocked", qid, chars: 31 })).status).toBe(200);
    expect((await post("/submit", {})).status).toBe(200);
    await engine!.query("update exams set ends_at = now() - interval '1 second' where id = $1", [fixture.examId]);
    const publish = () => request(fixture.exam + "/results/publish", { cookie: examiner, method: "POST" });
    expectCode(await publish(), 409, "PUBLICATION_BLOCKED");
    const queue = await request(fixture.exam + "/grading", { cookie: examiner });
    expect(queue).toMatchObject({ status: 200, data: { blockers: { ungraded: 1, unreviewed: 1 } } });
    const grade = (marks: number) => request("/api/answers/" + attemptId + "/" + qid + "/grade", { cookie: examiner, method: "PATCH", data: { marks, feedback: "Correct core idea." } });
    expectCode(await grade(4.25), 400, "MARKS_OUT_OF_RANGE");
    expect(await grade(3.75)).toMatchObject({ status: 200, data: { score: 3.75 } });
    const monitor = await request(fixture.exam + "/monitor", { cookie: admin });
    expect(monitor).toMatchObject({ status: 200, data: { incidents: [expect.objectContaining({ reviewStatus: "unreviewed" })] } });
    expect((await request("/api/incidents/" + monitor.data.incidents[0].id, { cookie: examiner, method: "PATCH",
      data: { status: "cleared", note: "Reviewed blocked paste." } })).status).toBe(200);
    expect(await publish()).toMatchObject({ status: 200, data: { published: true } });
    expect(await request("/api/candidate/results", { cookie: candidate })).toMatchObject({ status: 200, data: [expect.objectContaining({ score: 3.75 })] });
    expect((await request("/api/candidate/results", { cookie: other })).data).toEqual([]);
    const pdf = "/api/reports/" + attemptId + "/pdf";
    expectCode(await request(pdf, { cookie: other }), 403, "FORBIDDEN");
    const download = await fetch(base + pdf, { headers: { cookie: candidate } });
    expect(download.status, download.status === 200 ? "" : await download.clone().text()).toBe(200);
    expect(Buffer.from(await download.arrayBuffer()).subarray(0, 4).toString()).toBe("%PDF");
    const report = await engine!.query<{ verify_code: string }>("select verify_code from reports where attempt_id = $1", [attemptId]);
    expect(await request("/api/verify/" + report.rows[0].verify_code)).toMatchObject({ data: { valid: true, score: 3.75, name: "O*** c***" } });
    expect(await request("/api/verify/" + "0".repeat(40))).toMatchObject({ data: { valid: false } });
    expect(await request(fixture.exam + "/analytics/fairness", { cookie: examiner })).toMatchObject({ data: { simulations: 500 } });
  }, 90_000);

  it("enforces strict re-attempt approval and replaces the paper after cooldown", async ({ onTestFailed }) => {
    onTestFailed(() => { console.error(logs); });
    const examiner = await login("examiner");
    const admin = await login("admin");
    const candidate = await login("candidate2");
    const bank = await request("/api/questions", { cookie: examiner });
    const questionIds = bank.data.filter((item: { topic: string }) => item.topic === "Arithmetic").map((item: { id: string }) => item.id);
    const fixture = await activate(examiner, { title: "Strict arithmetic", questionIds, totalMarks: 2,
      settings: { integrityMode: "strict", blueprint: [{ topic: "Arithmetic", difficulty: 1, count: 1 }] } });
    const first = await fixture.start(candidate);
    expect(first.status).toBe(201);
    async function violate(run: { id: string; sessionId: string }) {
      const path = "/api/attempts/" + run.id;
      const options = { cookie: candidate, method: "POST", data: { sessionId: run.sessionId } };
      expect((await request(path + "/events", { ...options, data: { ...options.data, type: "fullscreen_exit" } })).status).toBe(200);
      await engine!.query("update attempts set pending_integrity_at = now() - interval '4 seconds' where id = $1", [run.id]);
      expect(await request(path + "/violation", options)).toMatchObject({ status: 200, data: { status: "voided" } });
    }
    await violate(first.data);
    const requests = await request("/api/requests", { cookie: examiner });
    const id = requests.data.find((row: { attemptId: string }) => row.attemptId === first.data.id).id;
    const decide = (cookie: string, data: Record<string, string>) => request("/api/requests", { cookie, method: "PATCH", data: { id, ...data } });
    expectCode(await decide(examiner, { action: "approve", reason: "Wrong role." }), 403, "FORBIDDEN");
    expect((await decide(examiner, { action: "forward", note: "Reviewed and forwarded." })).status).toBe(200);
    expect(await decide(admin, { action: "approve", reason: "Approved after review." })).toMatchObject({ status: 200, data: { status: "approved" } });
    expectCode(await fixture.start(candidate, "unused"), 409, "ENROLLMENT_UNAVAILABLE");
    await engine!.query("update enrollments set cooldown_until = now() - interval '1 second' where id = $1", [fixture.enrollmentId]);
    const available = await request("/api/candidate/exams", { cookie: candidate });
    const replacement = available.data.available.find((row: { id: string }) => row.id === fixture.examId).reattemptKey;
    const second = await fixture.start(candidate, replacement);
    expect(second.status, JSON.stringify(second)).toBe(201);
    const papers = await engine!.query<{ question_id: string }>("select question_id from attempt_questions where attempt_id in ($1, $2)", [first.data.id, second.data.id]);
    expect(new Set(papers.rows.map(({ question_id }) => question_id)).size).toBe(2);
    await violate(second.data);
    const blocked = await request("/api/admin/enrollments", { cookie: admin });
    expect(blocked.data).toEqual(expect.arrayContaining([expect.objectContaining({ id: fixture.enrollmentId, strikes: 2 })]));
  }, 90_000);

  it("builds sectioned exams from presets, bank picks and uploads, and draws sections in order (PRD §24.3)", async ({ onTestFailed }) => {
    onTestFailed(() => { console.error(logs); });
    const examiner = await login("examiner");
    const otherExaminer = await login("examiner2");
    const candidate = await login("candidate2");
    const presets = await request("/api/exam-presets", { cookie: examiner });
    expect(presets.data.map(({ type }: { type: string }) => type)).toEqual(["practice", "quiz", "assignment", "midterm", "final"]);
    expectCode(await request("/api/exam-presets", { cookie: candidate }), 403, "FORBIDDEN");

    const mcq = {
      type: "single", topic: "Algebra", difficulty: 2, marks: 1, course: "MATH-101",
      options: [{ id: "a", text: "4", isCorrect: true }, { id: "b", text: "5", isCorrect: false }],
    };
    const mcqIds: string[] = [];
    for (const text of ["2 + 2 = ?", "8 / 2 = ?"]) mcqIds.push((await request("/api/questions", { cookie: examiner, method: "POST", data: { ...mcq, text } })).data.id);
    const essay = await request("/api/questions", { cookie: examiner, method: "POST", data: {
      type: "written", topic: "Algebra", difficulty: 2, marks: 5, text: "Explain why x + 0 = x.", options: [] } });
    const now = Date.now();
    const made = await request("/api/exams", { cookie: examiner, method: "POST", data: {
      title: "Sectioned midterm", examType: "midterm", course: "MATH-101", startsAt: new Date(now - 30_000).toISOString(),
      endsAt: new Date(now + 600_000).toISOString(), durationMin: 10, totalMarks: 9, settings: { integrityMode: "standard" } } });
    expect(made, JSON.stringify(made)).toMatchObject({ status: 201, data: { examType: "midterm", course: "MATH-101" } });
    const s = `/api/exams/${made.data.id}/sections`;
    const listed = await request(s, { cookie: examiner });
    expect(listed.data).toHaveLength(1);
    const sectionA = listed.data[0].id;
    expectCode(await request(s, { cookie: otherExaminer }), 403, "FORBIDDEN");
    expect((await request(s, { cookie: examiner, method: "PATCH", data: { id: sectionA, title: "A — MCQs", allowedTypes: ["single"], marksPerQuestion: 2 } })).status).toBe(200);
    const sectionB = (await request(s, { cookie: examiner, method: "POST", data: { title: "B — Written", allowedTypes: ["written"], instructions: "Show your reasoning." } })).data.id;

    expectCode(await request(`${s}/${sectionA}/questions`, { cookie: examiner, method: "POST", data: { questionIds: [essay.data.id] } }), 400, "SECTION_TYPE_CONFLICT");
    expect((await request(`${s}/${sectionA}/questions`, { cookie: examiner, method: "POST", data: { questionIds: mcqIds } })).data.questionIds).toEqual(mcqIds);
    const choices = JSON.stringify([{ id: "a", text: "1", isCorrect: true }, { id: "b", text: "2", isCorrect: false }]).replaceAll('"', '""');
    const csv = ["type,topic,difficulty,text,marks,options", "written,Algebra,2,Prove that 0 + x = x.,5,",
      "written,Algebra,7,Broken row,5,", `single,Algebra,1,Wrong section,1,"${choices}"`].join("\n");
    const preview = await request(`${s}/${sectionB}/import`, { cookie: examiner, method: "POST", data: { format: "csv", content: csv } });
    expect(preview, JSON.stringify(preview)).toMatchObject({ status: 200, data: { imported: 0, valid: [{ row: 1 }], errors: [{ row: 2 }, { row: 3 }] } });
    const committed = await request(`${s}/${sectionB}/import`, { cookie: examiner, method: "POST", data: { format: "csv", content: csv, commit: true, tags: ["proofs"] } });
    expect(committed.data.imported).toBe(1);
    const bank = await request("/api/questions?course=MATH-101&tag=proofs", { cookie: examiner });
    expect(bank.data).toEqual([expect.objectContaining({ id: committed.data.questionIds[0], course: "MATH-101", tags: ["proofs"],
      usedIn: [{ examId: made.data.id, title: "Sectioned midterm" }] })]);

    const checklist = await request(`/api/exams/${made.data.id}/checklist`, { cookie: examiner });
    expect(checklist, JSON.stringify(checklist)).toMatchObject({ data: { canPublish: true } });
    expectCode(await request(`${s}/reorder`, { cookie: examiner, method: "PATCH", data: { sectionIds: [sectionB] } }), 400, "INVALID_SECTION_ORDER");
    const reordered = await request(`${s}/reorder`, { cookie: examiner, method: "PATCH", data: { sectionIds: [sectionB, sectionA] } });
    expect(reordered.data.map(({ id }: { id: string }) => id)).toEqual([sectionB, sectionA]);
    const emptySection = (await request(s, { cookie: examiner, method: "POST", data: { title: "C — Empty" } })).data.id;
    expect((await request(`/api/exams/${made.data.id}/checklist`, { cookie: examiner })).data.issues).toContain("C — Empty has no questions.");
    expect((await request(`${s}?sectionId=${emptySection}`, { cookie: examiner, method: "DELETE" })).status).toBe(200);

    const e = `/api/exams/${made.data.id}`;
    expect((await request(e + "/publish", { cookie: examiner, method: "POST" })).status).toBe(200);
    const enrolled = await request(e + "/enrollments", { cookie: examiner, method: "POST", data: { candidates: [{ candidateId: identities.candidate2 }] } });
    const keys = await request(e + "/keys", { cookie: examiner, method: "POST", data: { enrollmentIds: [enrolled.data[0].id] } });
    const started = await request(e + "/attempts", { cookie: candidate, method: "POST", data: { deviceCheck: true, key: keys.data[0].key } });
    expect(started, JSON.stringify(started)).toMatchObject({ status: 201, data: { totalQuestions: 3 } });
    const state = await request(`/api/attempts/${started.data.id}`, { cookie: candidate });
    expect(state.data.sections).toEqual([
      { id: sectionB, title: "B — Written", instructions: "Show your reasoning.", firstPosition: 1, count: 1 },
      { id: sectionA, title: "A — MCQs", instructions: "", firstPosition: 2, count: 2 },
    ]);
    expect(state.data.palette.map(({ sectionId }: { sectionId: string }) => sectionId)).toEqual([sectionB, sectionA, sectionA]);
    const first = await request(`/api/attempts/${started.data.id}/questions/1`, { cookie: candidate, headers: { "x-exam-session-id": started.data.sessionId } });
    expect(first.data).toMatchObject({ sectionId: sectionB, type: "written", marks: 5 });
    expect(JSON.stringify(first)).not.toContain("isCorrect");
    expectCode(await request(s, { cookie: examiner, method: "PATCH", data: { id: sectionA, title: "Renamed" } }), 409, "EXAM_FROZEN");
  });
});
