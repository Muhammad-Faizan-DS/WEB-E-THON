"use client";
import type { z } from "zod";
import type { ErrorCode } from "@/contracts";

/**
 * Typed fetch wrapper for the real SecureExam API (same-origin, httpOnly session cookie).
 * Pass a Zod schema to validate responses against the shared contracts.
 * The in-browser mock server was removed; USE_MOCKS stays exported (always false) for existing imports.
 */
export const USE_MOCKS = false;

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode | "NETWORK",
    message: string,
    public fields?: Record<string, string>,
    public details?: unknown,
  ) {
    super(message);
  }
  get isNetwork() {
    return this.code === "NETWORK";
  }
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

async function request<T>(method: Method, path: string, body?: unknown, schema?: z.ZodType<T>): Promise<T> {
  let status: number;
  let json: unknown;
  try {
    {
      const res = await fetch(path, {
        method,
        headers: body !== undefined ? { "content-type": "application/json" } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        credentials: "same-origin",
        cache: "no-store",
      });
      status = res.status;
      json = res.headers.get("content-type")?.includes("json") ? await res.json() : null;
    }
  } catch {
    throw new ApiError(0, "NETWORK", "Can't reach the exam server.");
  }
  if (status >= 400) {
    const err = (json as { error?: { code: ErrorCode; message: string; fields?: Record<string, string>; details?: unknown } })?.error;
    if (status === 401 && typeof window !== "undefined" && !path.startsWith("/api/auth/")) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    }
    throw new ApiError(status, err?.code ?? "VALIDATION", err?.message ?? `Request failed (${status})`, err?.fields, err?.details);
  }
  if (schema) {
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      console.error(`[contract] ${method} ${path} response does not match contract`, parsed.error.issues);
      return json as T; // don't break the UI in the demo; the console error is the signal
    }
    return parsed.data;
  }
  return json as T;
}

export const api = {
  get: <T>(path: string, schema?: z.ZodType<T>) => request<T>("GET", path, undefined, schema),
  post: <T>(path: string, body?: unknown, schema?: z.ZodType<T>) => request<T>("POST", path, body ?? {}, schema),
  put: <T>(path: string, body?: unknown, schema?: z.ZodType<T>) => request<T>("PUT", path, body ?? {}, schema),
  patch: <T>(path: string, body?: unknown, schema?: z.ZodType<T>) => request<T>("PATCH", path, body ?? {}, schema),
  del: <T>(path: string) => request<T>("DELETE", path),
};
