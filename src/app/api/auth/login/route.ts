import { z } from "zod";
import { signIn } from "@/server/auth";
import { meDto, unauthenticated, userIdByEmail } from "@/server/frontend-auth";

const credentials = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(72) });

/**
 * JSON sign-in for the frontend app. Delegates to the same Auth.js credentials provider as the portal
 * (bcrypt check, active accounts only), which sets the httpOnly session cookie, then returns the user.
 */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: { code: "FORBIDDEN", message: "Send sign-in from the same site." } }, { status: 403 });
  }
  const parsed = credentials.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: { code: "VALIDATION", message: "Enter a valid email and password." } }, { status: 400 });
  try {
    await signIn("credentials", { email: parsed.data.email, password: parsed.data.password, redirect: false });
  } catch {
    return unauthenticated("That email and password don't match an active account.");
  }
  const id = await userIdByEmail(parsed.data.email);
  const me = id ? await meDto(id) : null;
  return me ? Response.json(me, { headers: { "Cache-Control": "no-store" } }) : unauthenticated();
}
