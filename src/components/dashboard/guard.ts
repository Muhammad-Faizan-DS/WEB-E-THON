import { redirect } from "next/navigation";
import type { Role } from "@/lib/contracts/core";
import { auth } from "@/server/auth";

export type SignedInUser = { id: string; role: Role; name: string };

export const roleHome = (role: Role) => `/portal/${role}`;
export const roleLabel: Record<Role, string> = { admin: "Administrator", examiner: "Examiner", candidate: "Candidate" };

/** Current active account, or null. The session callback re-reads role + active flag from the database. */
export async function currentUser(): Promise<SignedInUser | null> {
  const user = (await auth())?.user;
  if (!user?.id || !user.role) return null;
  return { id: user.id, role: user.role, name: user.name ?? roleLabel[user.role] };
}

/** Page guard: signed-out → /login, wrong role → that account's own dashboard. UX only; APIs enforce RBAC themselves. */
export async function requireUser(role?: Role): Promise<SignedInUser> {
  const user = await currentUser();
  if (!user) redirect("/portal/login");
  if (role && user.role !== role) redirect(roleHome(user.role));
  return user;
}
