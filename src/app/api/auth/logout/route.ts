import { signOut } from "@/server/auth";

export async function POST() {
  await signOut({ redirect: false });
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
