import { timingSafeEqual } from "node:crypto";
import { sweepExpired } from "@/server/attempts";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  const headers = { "Cache-Control": "no-store" };
  if (!secret || auth.length !== expected.length || !timingSafeEqual(auth, expected)) {
    return Response.json({ error: { code: "UNAUTHENTICATED", message: "A cron credential is required." } }, { status: 401, headers });
  }
  return Response.json({ data: await sweepExpired() }, { headers });
}
