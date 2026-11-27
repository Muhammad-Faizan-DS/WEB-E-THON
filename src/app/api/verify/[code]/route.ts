import { verifyCode } from "@/lib/contracts/operations";
import { verifyReport } from "@/server/reports";

export async function GET(_request: Request, context: { params: Promise<{ code: string }> }) {
  const parsed = verifyCode.safeParse((await context.params).code);
  const data = parsed.success ? await verifyReport(parsed.data) : { valid: false };
  return Response.json({ data }, { headers: { "Cache-Control": "no-store" } });
}
