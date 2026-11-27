import { randomBytes } from "node:crypto";
import { type z } from "zod";
import { auditLog, orgSettings } from "../../db/schema";
import { type orgSettingsInput } from "@/lib/contracts/operations";
import { database, type Tx } from "./database";
import { fail } from "./errors";

type Db = Tx | ReturnType<typeof database>;
export type OrgSettings = typeof orgSettings.$inferSelect;

/** Public webmail providers are never treated as the institution's own domain (PRD §24.2: Gmail is never auto-allowed). */
const publicMailDomains = new Set(["gmail.com", "googlemail.com", "yahoo.com", "outlook.com", "hotmail.com", "live.com",
  "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com", "gmx.com", "yandex.com", "mail.com"]);

export async function readOrgSettings(db: Db = database()): Promise<OrgSettings> {
  const [row] = await db.select().from(orgSettings).limit(1);
  if (row) return row;
  const [created] = await db.insert(orgSettings).values({ id: true }).onConflictDoNothing().returning();
  return created ?? (await db.select().from(orgSettings).limit(1))[0];
}

export function updateOrgSettings(actorId: string, input: z.infer<typeof orgSettingsInput>) {
  return database().transaction(async (tx) => {
    const before = await readOrgSettings(tx);
    const [after] = await tx.update(orgSettings).set({ ...input, updatedAt: new Date() }).returning();
    await tx.insert(auditLog).values({ actorId, action: "org_settings_updated", entity: "org",
      entityId: "00000000-0000-0000-0000-000000000000", before, after });
    return after;
  });
}

export const emailDomain = (email: string) => email.slice(email.lastIndexOf("@") + 1).toLowerCase();

/**
 * True when the address belongs to the institution. With no allowed domains configured (local development),
 * every non-webmail domain counts as the institution's.
 */
export function isInstitutionEmail(email: string, settings: Pick<OrgSettings, "allowedDomains">) {
  const domain = emailDomain(email);
  if (publicMailDomains.has(domain)) return false;
  if (settings.allowedDomains.length === 0) return true;
  return settings.allowedDomains.some((allowed) => domain === allowed || domain.endsWith("." + allowed));
}

/** For a future Google sign-in (PRD §24.1): auto-create a CANDIDATE only for an explicitly allowed domain. */
export function mayAutoCreateFromSso(email: string, settings: Pick<OrgSettings, "allowedDomains">) {
  return settings.allowedDomains.length > 0 && isInstitutionEmail(email, settings);
}

/** Decides whether a new account is internal or an explicitly invited external one; refuses anything else. */
export function accountOrigin(email: string, explicitInvite: boolean, settings: OrgSettings) {
  if (isInstitutionEmail(email, settings)) return { isExternal: false };
  if (!explicitInvite) {
    fail(400, "EXTERNAL_INVITE_REQUIRED", `${email} is outside the institution's domains. Invite it as an external user.`);
  }
  if (!settings.allowExternalInvites) fail(403, "EXTERNAL_INVITES_DISABLED", "External invitations are turned off for this institution.");
  return { isExternal: true };
}

/** One-time password shown to the inviter for accounts created during enrolment. Nothing is emailed. */
export function temporaryPassword() {
  return randomBytes(12).toString("base64url");
}
