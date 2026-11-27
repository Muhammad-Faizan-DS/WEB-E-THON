import { createHash, randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { and, eq, inArray } from "drizzle-orm";
import { activationKeys, answers, attempts, attemptQuestions, enrollments, examQuestions, examSections, exams, incidents, orgSettings, questions, reattemptRequests, users } from "../db/schema";
import { settings, type AnswerResponse, type BlueprintCell, type ExamSettings, type ExamType, type QuestionInput } from "../src/lib/contracts/core";
import { database, type Tx } from "../src/server/database";
import { activationKeyFor, displayKey, drawPaper, hashKey, type PaperQuestion } from "../src/server/paper";
import { objectiveMarksCents } from "../src/server/grading";

const topics = ["Arithmetic", "Algebra", "Data literacy", "Logic"];
const difficulties = [1, 2, 3] as const;
const candidateEmails = Array.from({ length: 40 }, (_, i) => i === 0 ? "candidate@example.test" : `candidate${i + 1}@example.test`);
const liveTitle = "SecureExam Live Exam";
const course = "MATH-101";
/** Invited from outside the institution's domain (PRD §24.2); the .example TLD is reserved, so nothing real is addressed. */
const externalEmail = "visitor@partner.example";

function makeQuestions(): QuestionInput[] {
  return topics.flatMap((topic, subject) => difficulties.flatMap((difficulty) => Array.from({ length: 5 }, (_, variant) => {
    const n = subject * 15 + difficulty * 5 + variant + 2;
    const common = { topic, difficulty, marks: difficulty };
    if (variant === 3) return { ...common, type: "written", text: `${topic}: explain how to check the calculation ${n} × 3.`, options: [] };
    if (variant === 2) return { ...common, type: "multi", text: `${topic}: select the multiples of ${n}.`,
      options: [n, n + 1, n * 2, n * 2 + 1].map((value, index) => ({ id: randomUUID(), text: String(value), isCorrect: index % 2 === 0 })) };
    const wrongKey = subject === 0 && difficulty === 1 && variant === 0;
    return { ...common, type: "single", text: `${topic}: what is ${n} + ${difficulty}?`,
      options: [n + difficulty, n + difficulty + 1, n + difficulty + 2, n + difficulty + 3].map((value, index) => ({
        id: randomUUID(), text: String(value), isCorrect: index === (wrongKey ? 1 : 0),
      })) };
  })));
}

type SeedSection = { title: string; instructions?: string; blueprint?: BlueprintCell[]; questions: PaperQuestion[] };

async function seedExam(tx: Tx, examinerId: string, people: string[], fields: {
  title: string; instructions: string; startsAt: Date; endsAt: Date; durationMin: number; settings: ExamSettings;
  examType?: ExamType; course?: string;
}, pool: PaperQuestion[], sectionPlan: SeedSection[] = [{ title: "Section A", questions: pool }]) {
  const totalMarks = fields.settings.blueprint.length
    ? fields.settings.blueprint.reduce((sum, cell) => sum + cell.count *
      (pool.find((question) => question.topic === cell.topic && question.difficulty === cell.difficulty)?.marks ?? 0), 0)
    : pool.reduce((sum, question) => sum + question.marks, 0);
  const [exam] = await tx.insert(exams).values({ ...fields, examinerId, totalMarks, status: "published" }).returning();
  const sections = await tx.insert(examSections).values(sectionPlan.map((section, index) => ({
    examId: exam.id, title: section.title, instructions: section.instructions ?? "", position: index + 1, blueprint: section.blueprint ?? [],
  }))).returning();
  await tx.insert(examQuestions).values(sectionPlan.flatMap((section, index) => section.questions.map(({ id, ...question }, position) => ({
    examId: exam.id, questionId: id, sectionId: sections[index].id, position: position + 1,
    snapshot: { type: question.type, text: question.text, topic: question.topic, difficulty: question.difficulty, marks: question.marks, options: question.options },
  }))));
  const members = await tx.insert(enrollments).values(people.map((candidateId) => ({ examId: exam.id, candidateId }))).returning();
  return { exam, members, sections };
}

async function archivedMidterm(tx: Tx, examiner: string, people: string[], pool: PaperQuestion[], now: number) {
  const matched = topics.flatMap((topic) => [1, 2].map((difficulty) => pool.find((item) => item.topic === topic && item.difficulty === difficulty && item.type === "single")!));
  const selected = [...matched, pool.find((item) => item.topic === "Arithmetic" && item.difficulty === 3 && item.type === "written")!];
  const config = settings.parse({ blueprint: selected.map(({ topic, difficulty }) => ({ topic, difficulty, count: 1 })), integrityMode: "standard" });
  const start = new Date(now - 86_400_000);
  const end = new Date(start.getTime() + 3_600_000);
  const cells = (items: PaperQuestion[]) => items.map(({ topic, difficulty }) => ({ topic, difficulty, count: 1 }));
  const written = selected.filter(({ type }) => type === "written");
  // Same-cell alternatives make the pool larger than one paper, so the fairness simulation has real choices to compare.
  const alternatives = pool.filter((item) => item.type === "single" && !matched.includes(item));
  const { exam, members, sections } = await seedExam(tx, examiner, people.slice(0, 31), {
    title: "Midterm — completed", instructions: "Answer each question. Published results include your instructor feedback.",
    startsAt: start, endsAt: end, durationMin: 45, settings: config, examType: "midterm", course,
  }, [...selected, ...alternatives], [
    { title: "A — Multiple choice", instructions: "Choose one answer for each question.", blueprint: cells(matched), questions: [...matched, ...alternatives] },
    { title: "B — Written", instructions: "Explain your reasoning in full sentences.", blueprint: cells(written), questions: written },
  ]);
  const inSection = selected.map((question) => ({ ...question, sectionId: sections[question.type === "written" ? 1 : 0].id }));
  const paper = drawPaper(inSection, config, { sections: sections.map((section) => ({
    id: section.id, title: section.title, blueprint: section.blueprint, shuffle: section.shuffle, marksPerQuestion: section.marksPerQuestion,
  })) });
  const seat = new Map(people.map((id, index) => [id, index]));
  const added = await tx.insert(attempts).values(members.map((row) => ({
    examId: exam.id, candidateId: row.candidateId, enrollmentId: row.id, status: (seat.get(row.candidateId) === 30 ? "voided" : "graded") as "voided" | "graded",
    activeSessionId: randomUUID(), startedAt: start, deadlineAt: new Date(start.getTime() + 2_700_000), submittedAt: end,
    lastHeartbeatAt: end, settings: config,
  }))).returning();
  await tx.insert(attemptQuestions).values(added.flatMap((attempt) => paper.map((question) => ({ ...question, attemptId: attempt.id, seenAt: start }))));
  const grades = [];
  for (const attempt of added) {
    const index = seat.get(attempt.candidateId)!;
    if (attempt.status === "voided") {
      if (attempt.enrollmentId) {
        await tx.update(enrollments).set({ status: "rejected", strikes: 1 }).where(eq(enrollments.id, attempt.enrollmentId));
        await tx.insert(reattemptRequests).values({ attemptId: attempt.id, enrollmentId: attempt.enrollmentId, status: "approved",
          examinerNote: "Review completed.", adminReason: "Replacement authorized after review.", decidedAt: end });
        await tx.update(enrollments).set({ status: "cooldown", cooldownUntil: new Date(end.getTime() + 900_000) })
          .where(eq(enrollments.id, attempt.enrollmentId));
      }
      continue;
    }
    let scoreCents = 0;
    for (const question of paper) {
      let response: AnswerResponse, awardedCents: number | null = null;
      if (question.type === "written") {
        response = "I would add the number three times and compare it to the computed product.";
        awardedCents = index % 4 === 0 ? 200 : 300;
      } else {
        const wrong = question.options.filter((option) => !question.answerKey.includes(option.id));
        const colluding = index === 8 || index === 9;
        // Honest candidates err independently (deterministic hash), so only the planted pair shares many wrong answers.
        // Stronger candidates (two in three) err less, which gives items positive discrimination.
        const [roll, pick] = createHash("sha256").update(`${index}:${question.position}`).digest();
        const strong = index % 3 !== 0;
        const misKeyed = question.questionId === matched[0].id;
        if (misKeyed && !colluding) {
          // The planted answer-key error: strong candidates choose the true answer, which the key marks wrong ("Check answer key").
          const truth = pool.find(({ id }) => id === question.questionId)!.options[0].id;
          response = strong ? truth : question.answerKey[0];
        } else {
          const chooseWrong = colluding || roll % 10 < (strong ? 2 : 6);
          response = chooseWrong ? wrong[colluding ? 0 : pick % wrong.length].id : question.answerKey[0];
        }
      }
      scoreCents += awardedCents ?? objectiveMarksCents(question.answerKey, response, question.marks, config.multiSelectRule);
      grades.push({ attemptId: attempt.id, questionId: question.questionId, response, seq: 1, savedAt: end, awardedCents,
        feedback: awardedCents === null ? null : "You identified a valid way to check the product.", graderId: awardedCents === null ? null : examiner });
    }
    await tx.update(attempts).set({ scoreCents }).where(eq(attempts.id, attempt.id));
  }
  await tx.insert(answers).values(grades);
  await tx.insert(incidents).values(added.slice(0, 2).map((attempt, index) => ({
    attemptId: attempt.id, startedAt: start, endedAt: new Date(start.getTime() + 45_000),
    priority: "review" as const, summary: "Fullscreen departure and return",
    reviewStatus: index === 0 ? "cleared" as const : "confirmed" as const, outcome: index === 0 ? null : "warning_only" as const,
    reviewerId: examiner, note: "Examiner reviewed the browser signals.",
  })));
  await tx.update(exams).set({ frozenAt: start, resultsPublished: true }).where(eq(exams.id, exam.id));
}

async function seed() {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") throw new Error("Demo fixtures require a development database.");
  const password = process.env.SEED_PASSWORD;
  if (!password || Buffer.byteLength(password) < 12 || Buffer.byteLength(password) > 72) throw new Error("Set SEED_PASSWORD to 12–72 bytes.");
  const db = database();
  try {
    const passwordHash = await hash(password, 12);
    const accounts = [
      { email: "admin@example.test", name: "Demo Admin", role: "admin", isExternal: false },
      { email: "examiner@example.test", name: "Demo Examiner", role: "examiner", isExternal: false },
      { email: "examiner2@example.test", name: "Demo Examiner Two", role: "examiner", isExternal: false },
      ...candidateEmails.map((email, index) => ({ email, name: `Candidate ${String(index + 1).padStart(2, "0")}`, role: "candidate" as const, isExternal: false })),
      { email: externalEmail, name: "External Visitor", role: "candidate", isExternal: true },
    ] as const;
    const demoKey = await db.transaction(async (tx) => {
      await tx.insert(orgSettings).values({ id: true, name: "SecureExam Demo Institute", allowedDomains: ["example.test"], allowExternalInvites: true })
        .onConflictDoUpdate({ target: orgSettings.id, set: { name: "SecureExam Demo Institute", allowedDomains: ["example.test"], updatedAt: new Date() } });
      await tx.insert(users).values(accounts.map((account) => ({ ...account, passwordHash }))).onConflictDoNothing();
      const rows = await tx.select({ id: users.id, email: users.email, role: users.role }).from(users)
        .where(inArray(users.email, accounts.map(({ email }) => email)));
      const byEmail = new Map(rows.map((row) => [row.email, row]));
      if (accounts.some((account) => byEmail.get(account.email)?.role !== account.role)) throw new Error("Existing demo accounts have unexpected roles.");
      const examiner = byEmail.get("examiner@example.test")!.id;
      const people = candidateEmails.map((email) => byEmail.get(email)!.id);
      const [existing] = await tx.select({ id: exams.id }).from(exams).where(and(eq(exams.examinerId, examiner), eq(exams.title, liveTitle)));
      if (existing) return null;
      const pool = await tx.insert(questions).values(makeQuestions().map((item) => ({ ...item, course, ownerId: examiner }))).returning();
      const visitor = byEmail.get(externalEmail)!.id;
      const now = Date.now();
      await archivedMidterm(tx, examiner, people, pool, now);
      const currentPool = pool.filter((item) => item.topic === "Arithmetic" && item.difficulty === 1);
      const blueprint = [{ topic: "Arithmetic", difficulty: 1 as const, count: 2 }];
      const demoExams = [
        { title: liveTitle, start: now - 60_000, end: now + 7_200_000, mode: "strict" as const, candidates: people },
        { title: "Arithmetic — upcoming", start: now + 86_400_000, end: now + 93_600_000, mode: "review" as const, candidates: people.slice(0, 5) },
        { title: "Arithmetic — practice", start: now - 60_000, end: now + 7_200_000, mode: "standard" as const, candidates: [...people.slice(0, 5), visitor] },
      ];
      let firstKey = "";
      for (const item of demoExams) {
        const { members } = await seedExam(tx, examiner, item.candidates, {
          title: item.title, startsAt: new Date(item.start), endsAt: new Date(item.end), durationMin: 30, course,
          examType: item.mode === "standard" ? "practice" as const : item.mode === "strict" ? "midterm" as const : "quiz" as const,
          instructions: "Read the instructions and answer each released question before submitting.",
          settings: item.mode === "standard"
            ? settings.parse({ blueprint, integrityMode: "standard", openLimit: null, sequentialReveal: false })
            : settings.parse({ blueprint, integrityMode: item.mode, openLimit: 1 }),
        }, currentPool);
        if (item.mode === "standard") continue; // practice exams open without a key
        // One key per candidate, derived from its row id; the key also seeds that candidate's paper.
        const issued = members.map((member) => {
          const id = randomUUID();
          const key = activationKeyFor(id);
          if (item.title === liveTitle && member.candidateId === people[0]) firstKey = displayKey(key);
          return { id, enrollmentId: member.id, keyHash: hashKey(key), hint: key.slice(-2) };
        });
        await tx.insert(activationKeys).values(issued);
      }
      return firstKey;
    });
    console.log("Development fixtures are ready.", demoKey ? "Live exam key for candidate@example.test: " + demoKey : "Use the examiner workspace to issue any needed activation keys.");
  } finally {
    await db.$client.end();
  }
}
seed().catch((error) => {
  console.error(error instanceof Error ? error.message : "Demo seed failed.");
  process.exitCode = 1;
});
