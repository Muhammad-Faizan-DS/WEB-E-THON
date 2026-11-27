import { hash } from "bcryptjs";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import type { z } from "zod";
import { attempts, auditLog, enrollments, exams, incidents, preferences, reattemptRequests, users } from "../../db/schema";
import { account, accountPatch, workspacePrefs } from "@/lib/contracts/operations";
import { accountOrigin, readOrgSettings } from "./accounts";
import { database, type Tx } from "./database";
import { fail } from "./errors";

const profile = { id: users.id, name: users.name, email: users.email, role: users.role, active: users.active,
  isExternal: users.isExternal, createdAt: users.createdAt };

export function audit(tx: Tx, actorId: string, action: string, entity: string, entityId: string, details: {
  reason?: string; before?: unknown; after?: unknown;
} = {}) {
  return tx.insert(auditLog).values({ actorId, action, entity, entityId, ...details });
}

export function listAccounts() {
  return database().select(profile).from(users).orderBy(desc(users.createdAt)).limit(1_000);
}

/** Admin-created accounts. Addresses outside the allowed domains are accepted only as explicit external invites (PRD §24.2). */
export async function createAccount(actorId: string, { password, external, ...details }: z.infer<typeof account>) {
  const { isExternal } = accountOrigin(details.email, external, await readOrgSettings());
  const passwordHash = await hash(password, 12);
  return database().transaction(async (tx) => {
    const [row] = await tx.insert(users).values({ ...details, isExternal, passwordHash }).onConflictDoNothing().returning(profile);
    if (!row) fail(409, "EMAIL_EXISTS", "An account already uses this email.");
    await audit(tx, actorId, isExternal ? "external_user_invited" : "user_created", "user", row.id, { after: { role: row.role, isExternal } });
    return row;
  });
}

/** Admin only (route guard). Role changes, e.g. candidate → examiner, are audit-logged as `role_changed` with the reason. */
export function editAccount(actorId: string, { id, reason, ...patch }: z.infer<typeof accountPatch>) {
  if (id === actorId && (patch.active === false || (patch.role && patch.role !== "admin"))) {
    fail(409, "SELF_ADMIN_CHANGE", "Use another active administrator to change your own access.");
  }
  return database().transaction(async (tx) => {
    const [before] = await tx.select(profile).from(users).where(eq(users.id, id)).for("update");
    if (!before) fail(404, "USER_NOT_FOUND", "Account not found.");
    const [after] = await tx.update(users).set(patch).where(eq(users.id, id)).returning(profile);
    const roleChanged = patch.role !== undefined && patch.role !== before.role;
    await audit(tx, actorId, roleChanged ? "role_changed" : "user_updated", "user", id, { before, after, reason });
    return after;
  });
}

export async function knownEmails(emails: string[]) {
  if (emails.length === 0) return new Set<string>();
  const email = sql<string>`lower(${users.email})`;
  const rows = await database().select({ email }).from(users).where(inArray(email, emails));
  return new Set(rows.map((row) => row.email));
}

export function listAudit(examinerId?: string) {
  const db = database();
  const ownExams = db.select({ id: exams.id }).from(exams).where(eq(exams.examinerId, examinerId ?? ""));
  const ownAttempts = db.select({ id: attempts.id }).from(attempts).where(inArray(attempts.examId, ownExams));
  const ownEnrollments = db.select({ id: enrollments.id }).from(enrollments).where(inArray(enrollments.examId, ownExams));
  const ownIncidents = db.select({ id: incidents.id }).from(incidents).where(inArray(incidents.attemptId, ownAttempts));
  const ownRequests = db.select({ id: reattemptRequests.id }).from(reattemptRequests).where(inArray(reattemptRequests.attemptId, ownAttempts));
  return db.select({ id: auditLog.id, actor: users.name, action: auditLog.action, entity: auditLog.entity, entityId: auditLog.entityId,
    reason: auditLog.reason, before: auditLog.before, after: auditLog.after, at: auditLog.at })
    .from(auditLog).innerJoin(users, eq(auditLog.actorId, users.id))
    .where(examinerId ? or(
      and(eq(auditLog.entity, "exam"), inArray(auditLog.entityId, ownExams)),
      and(eq(auditLog.entity, "attempt"), inArray(auditLog.entityId, ownAttempts)),
      and(eq(auditLog.entity, "enrollment"), inArray(auditLog.entityId, ownEnrollments)),
      and(eq(auditLog.entity, "incident"), inArray(auditLog.entityId, ownIncidents)),
      and(eq(auditLog.entity, "reattempt"), inArray(auditLog.entityId, ownRequests)),
    ) : undefined).orderBy(desc(auditLog.at), desc(auditLog.id)).limit(500);
}

export async function readPrefs(userId: string) {
  const [row] = await database().select().from(preferences).where(eq(preferences.userId, userId));
  return row?.prefs ?? workspacePrefs.parse({});
}

export async function savePrefs(userId: string, prefs: z.infer<typeof workspacePrefs>) {
  await database().insert(preferences).values({ userId, prefs }).onConflictDoUpdate({ target: preferences.userId, set: { prefs } });
  return prefs;
}
