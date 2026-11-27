import { compare } from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { users } from "../../db/schema";
import { id, type Role } from "@/lib/contracts/core";
import { database } from "./database";
import { fail } from "./errors";

const credentials = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(1).max(72).refine((password) => Buffer.byteLength(password) <= 72),
});
const dummyHash = "$2a$12$wYpFUY49kVj26TW0sQiAkeYp8h2UANkq55eVIoa3w.C43NUWCfK4C";

declare module "next-auth" {
  interface Session {
    user: { id: string; role?: Role; name?: string | null; email?: string | null; image?: string | null };
  }
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  // Use the request's own host for callback and sign-out URLs (localhost:any-port, Vercel preview or production).
  // AUTH_URL is optional and only needed to pin a canonical origin.
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [Credentials({
    credentials: { email: { type: "email" }, password: { type: "password" } },
    async authorize(raw) {
      const parsed = credentials.safeParse(raw);
      if (!parsed.success) return null;
      const { email, password } = parsed.data;
      const [user] = await database().select().from(users).where(sql`lower(${users.email}) = ${email}`);
      const valid = await compare(password, user?.passwordHash ?? dummyHash);
      if (!valid || !user?.active) return null;
      return { id: user.id, name: user.name, email: user.email };
    },
  })],
  callbacks: {
    async session({ session, token }) {
      const identity = id.safeParse(token.sub);
      const [actor] = identity.success
        ? await database().select({ id: users.id, role: users.role, active: users.active })
          .from(users).where(eq(users.id, identity.data))
        : [];
      return actor?.active
        ? { ...session, user: { ...session.user, id: actor.id, role: actor.role } }
        : { expires: session.expires, user: { id: "" } };
    },
  },
});

export type Actor = { id: string; role: Role };

export async function requireRole(roles: readonly Role[]): Promise<Actor> {
  const session = await auth();
  const actor = session?.user;
  if (!actor?.id || !actor.role) fail(401, "UNAUTHENTICATED", "Sign in with an active account to continue.");
  if (!roles.includes(actor.role)) fail(403, "FORBIDDEN", "You cannot perform this action.");
  return { id: actor.id, role: actor.role };
}
