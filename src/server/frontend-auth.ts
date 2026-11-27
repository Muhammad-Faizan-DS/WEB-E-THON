import { eq, sql } from "drizzle-orm";
import { users } from "../../db/schema";
import { readPrefs } from "./admin";
import { auth } from "./auth";
import { database } from "./database";

/** Shape the frontend app (src/contracts/auth.ts) expects for the signed-in user. */
export async function meDto(userId: string) {
  const [user] = await database().select({ id: users.id, name: users.name, email: users.email, role: users.role, active: users.active })
    .from(users).where(eq(users.id, userId));
  if (!user?.active) return null;
  const prefs = await readPrefs(user.id);
  return {
    id: user.id, name: user.name, email: user.email, role: user.role,
    preferences: {
      textSize: prefs.fontSize === "extra-large" ? "xl" : prefs.fontSize === "large" ? "lg" : "md",
      layout: prefs.layout === "split" ? "split" : "single",
      navigatorPosition: "left", theme: prefs.theme, reduceMotion: false,
    },
  };
}

export async function currentMe() {
  const id = (await auth())?.user?.id;
  return id ? meDto(id) : null;
}

export async function userIdByEmail(email: string) {
  const [row] = await database().select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email.trim().toLowerCase()}`);
  return row?.id ?? null;
}

export const unauthenticated = (message = "Please sign in.") =>
  Response.json({ error: { code: "UNAUTHENTICATED", message } }, { status: 401, headers: { "Cache-Control": "no-store" } });
