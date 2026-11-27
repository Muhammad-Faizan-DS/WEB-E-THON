/**
 * Admin DTOs (accounts and audit log). Kept client-side, like proctor.ts, until Dev A adds them to
 * src/contracts; the shapes match the mock API in src/mocks/server.ts.
 */
import { z } from "zod";

export const AdminUser = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(["admin", "examiner", "candidate"]),
  studentId: z.string().nullable(),
  active: z.boolean(),
  tempPassword: z.boolean(),
});
export type AdminUser = z.infer<typeof AdminUser>;
export const AdminUsers = z.object({ users: z.array(AdminUser) });

export const ResetResult = z.object({ temporaryPassword: z.string() });

export const AuditEntry = z.object({ id: z.string(), at: z.string(), by: z.string(), action: z.string(), target: z.string(), note: z.string() });
export type AuditEntry = z.infer<typeof AuditEntry>;
export const AuditLog = z.object({ entries: z.array(AuditEntry) });

/** Reason kept on record for disabling or re-enabling an account. */
export const StatusReason = z.string().trim().min(4, "Give a short reason (at least 4 characters).").max(300);
