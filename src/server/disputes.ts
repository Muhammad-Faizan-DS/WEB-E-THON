import { aliasedTable, and, desc, eq } from "drizzle-orm";
import type { z } from "zod";
import { disputes, enrollments, exams, users } from "../../db/schema";
import type { disputeInput, disputeUpdate } from "@/lib/contracts/operations";
import { audit } from "./admin";
import type { Actor } from "./auth";
import { database } from "./database";
import { fail } from "./errors";
import { activeAdminIds, notify } from "./notifications";

const examiner = aliasedTable(users, "dispute_examiner");
const candidate = aliasedTable(users, "dispute_candidate");

/**
 * A candidate raises a dispute. It reaches the exam's examiner and every administrator; when it concerns the
 * examiner (aboutExaminer), only administrators see it, so a teacher cannot bury a complaint about themselves.
 */
export function fileDispute(actor: Actor, input: z.infer<typeof disputeInput>) {
  return database().transaction(async (tx) => {
    let examinerId: string | null = null;
    let examTitle = "";
    if (input.examId) {
      const [row] = await tx.select({ examinerId: exams.examinerId, title: exams.title }).from(enrollments)
        .innerJoin(exams, eq(exams.id, enrollments.examId))
        .where(and(eq(enrollments.examId, input.examId), eq(enrollments.candidateId, actor.id)));
      if (!row) fail(403, "FORBIDDEN", "Choose an exam you are enrolled in.");
      examinerId = row.examinerId;
      examTitle = row.title;
    }
    const [dispute] = await tx.insert(disputes).values({ ...input, candidateId: actor.id }).returning();
    const recipients = [...(input.aboutExaminer ? [] : [examinerId]), ...await activeAdminIds(tx)];
    await notify(tx, recipients, { kind: "dispute", title: `New dispute: ${input.subject}`,
      body: `${examTitle ? examTitle + " · " : ""}${input.category}${input.aboutExaminer ? " · concerns the examiner (admins only)" : ""}`, link: "/disputes" });
    await audit(tx, actor.id, "dispute_filed", "dispute", dispute.id, { after: { category: input.category, aboutExaminer: input.aboutExaminer, examId: input.examId ?? null } });
    return dispute;
  });
}

/** Candidates see their own; examiners see disputes on their exams that are not about them; admins see all. */
export function listDisputes(actor: Actor) {
  return database().select({
    id: disputes.id, category: disputes.category, subject: disputes.subject, body: disputes.body, aboutExaminer: disputes.aboutExaminer,
    status: disputes.status, response: disputes.response, createdAt: disputes.createdAt, updatedAt: disputes.updatedAt,
    examId: disputes.examId, exam: exams.title, candidate: candidate.name, candidateEmail: candidate.email, examiner: examiner.name,
  }).from(disputes).innerJoin(candidate, eq(candidate.id, disputes.candidateId))
    .leftJoin(exams, eq(exams.id, disputes.examId)).leftJoin(examiner, eq(examiner.id, exams.examinerId))
    .where(actor.role === "candidate" ? eq(disputes.candidateId, actor.id)
      : actor.role === "examiner" ? and(eq(exams.examinerId, actor.id), eq(disputes.aboutExaminer, false)) : undefined)
    .orderBy(desc(disputes.createdAt)).limit(300);
}

export function answerDispute(actor: Actor, id: string, input: z.infer<typeof disputeUpdate>) {
  return database().transaction(async (tx) => {
    const [row] = await tx.select({ dispute: disputes, examinerId: exams.examinerId }).from(disputes)
      .leftJoin(exams, eq(exams.id, disputes.examId)).where(eq(disputes.id, id)).for("update", { of: disputes });
    const allowed = row && (actor.role === "admin" || (row.examinerId === actor.id && !row.dispute.aboutExaminer));
    if (!allowed) fail(404, "DISPUTE_NOT_FOUND", "Dispute not found.");
    const [updated] = await tx.update(disputes).set({ status: input.status, response: input.response, handledBy: actor.id, updatedAt: new Date() })
      .where(eq(disputes.id, id)).returning();
    await notify(tx, [row.dispute.candidateId], { kind: "dispute", title: `Your dispute is ${input.status.replace("_", " ")}`,
      body: input.response, link: "/candidate/disputes" });
    // Administrators always learn how an examiner handled a dispute.
    if (actor.role === "examiner") await notify(tx, await activeAdminIds(tx), { kind: "dispute", title: `Examiner ${input.status.replace("_", " ")} a dispute`,
      body: `${row.dispute.subject}: ${input.response}`, link: "/disputes" });
    await audit(tx, actor.id, "dispute_" + input.status, "dispute", id, { reason: input.response, before: { status: row.dispute.status }, after: { status: input.status } });
    return updated;
  });
}

