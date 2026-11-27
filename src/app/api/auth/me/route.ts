import { currentMe, unauthenticated } from "@/server/frontend-auth";

export const dynamic = "force-dynamic";

/** The signed-in user for the frontend app (role is re-read from the database on every call). */
export async function GET() {
  const me = await currentMe();
  return me ? Response.json(me, { headers: { "Cache-Control": "no-store" } }) : unauthenticated();
}
