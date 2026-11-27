import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { enrollments, notifications, users } from "../../db/schema";
import { database, type Tx } from "./database";

type Db = Tx | ReturnType<typeof database>;
export type Notice = { kind: string; title: string; body?: string; link?: string };

/** Queues one in-app notification per recipient (deduplicated). Nothing leaves the platform. */
export async function notify(db: Db, userIds: Array<string | null | undefined>, notice: Notice) {
  const recipients = [...new Set(userIds.filter((value): value is string => Boolean(value)))];
  if (!recipients.length) return;
  await db.insert(notifications).values(recipients.map((userId) => ({ userId, kind: notice.kind, title: notice.title.slice(0, 200),
    body: (notice.body ?? "").slice(0, 2_000), link: notice.link ?? null })));
}

export async function activeAdminIds(db: Db) {
  return (await db.select({ id: users.id }).from(users).where(and(eq(users.role, "admin"), eq(users.active, true)))).map(({ id }) => id);
}

export async function enrolledCandidateIds(db: Db, examId: string) {
  return (await db.select({ id: enrollments.candidateId }).from(enrollments).where(eq(enrollments.examId, examId))).map(({ id }) => id);
}

export async function listNotifications(userId: string) {
  const db = database();
  const items = await db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(30);
  const [{ unread }] = await db.select({ unread: sql<number>`count(*)::int` }).from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return { unread, items };
}

export async function markNotificationsRead(userId: string, input: { ids?: string[]; all?: boolean }) {
  await database().update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, userId), isNull(notifications.readAt),
    input.all ? undefined : inArray(notifications.id, input.ids ?? [])));
  return listNotifications(userId);
}
