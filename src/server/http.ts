import { z } from "zod";
import { type Role } from "@/lib/contracts/core";
import { requireRole, type Actor } from "./auth";
import { ApiError, fail } from "./errors";

export function input<T extends z.ZodTypeAny>(schema: T, value: unknown): z.output<T> {
  return schema.parse(value);
}

export async function body<T extends z.ZodTypeAny>(request: Request, schema: T): Promise<z.output<T>> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) {
    fail(415, "CONTENT_TYPE_REQUIRED", "Send this request as JSON.");
  }
  const bytes = await requestBytes(request, 1_000_000);
  let value: unknown;
  try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { fail(400, "INVALID_JSON", "Send a valid JSON request."); }
  return input(schema, value);
}

export async function requestBytes(request: Request, limit: number) {
  if (Number(request.headers.get("content-length")) > limit) fail(413, "BODY_TOO_LARGE", "Request is too large.");
  const stream = request.body?.getReader();
  if (!stream) fail(400, "MISSING_BODY", "Send a request body.");
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (true) {
      const { done, value } = await stream.read();
      if (done) break;
      received += value.byteLength;
      if (received > limit) {
        await stream.cancel();
        fail(413, "BODY_TOO_LARGE", "Request is too large.");
      }
      chunks.push(value);
    }
  } finally { stream.releaseLock(); }
  return Buffer.concat(chunks);
}

type Context = { params: Promise<Record<string, string>> };
type Action = (request: Request, params: Record<string, string>, actor: Actor) => Promise<unknown>;

export function route(roles: readonly Role[], action: Action, status = 200, attempt = false) {
  return async (request: Request, context: Context) => {
    try {
      const origin = request.headers.get("origin");
      if (request.method !== "GET" && origin && origin !== new URL(request.url).origin) {
        fail(403, "FORBIDDEN_ORIGIN", "Send changes from the same site.");
      }
      const actor = await requireRole(roles);
      const data = await action(request, (await context?.params) ?? {}, actor);
      return data instanceof Response ? data : json({ data }, status, attempt);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return json({ error: { code: "VALIDATION_ERROR", message: "Check the request fields.",
          fieldErrors: error.flatten().fieldErrors } }, 400, attempt);
      }
      if (error instanceof ApiError) {
        return json({ error: { code: error.code, message: error.message } }, error.status, attempt);
      }
      console.error("SecureExam request failed:", error instanceof Error ? error.name : "UnknownError");
      return json({ error: { code: "INTERNAL_ERROR", message: "The request could not be completed." } }, 500, attempt);
    }
  };
}

export function fileResponse(content: string | Uint8Array, name: string, mime: string) {
  return new Response(typeof content === "string" ? content : new Uint8Array(content), { headers: {
    "Content-Type": mime, "Content-Disposition": `attachment; filename="${name}"`,
    "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
  } });
}

function json(payload: object, status: number, attempt: boolean) {
  return Response.json({ ...payload, ...(attempt ? { serverNow: new Date().toISOString() } : {}) },
    { status, headers: { "Cache-Control": "no-store" } });
}
