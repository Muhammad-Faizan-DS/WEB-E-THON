"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiResponse } from "@/lib/contracts/core";

export class RequestError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) { super(message); }
}

export async function request<T>(path: string, method = "GET", data?: unknown, headers?: HeadersInit) {
  const wire = new Headers(headers);
  const binary = typeof Blob !== "undefined" && data instanceof Blob;
  if (data !== undefined && !binary) wire.set("content-type", "application/json");
  const response = await fetch(path, {
    method, headers: wire, body: binary ? data : data === undefined ? undefined : JSON.stringify(data), cache: "no-store",
  });
  let result: ApiResponse<T>;
  try { result = await response.json() as ApiResponse<T>; }
  catch { throw new RequestError("BAD_RESPONSE", "SecureExam returned an unexpected response. Try again.", response.status); }
  if ("error" in result) throw new RequestError(result.error.code, result.error.message, response.status);
  if (!response.ok) throw new RequestError("REQUEST_FAILED", "The request failed.", response.status);
  return result;
}
export const message = (error: unknown) => error instanceof Error ? error.message : "The request could not be completed.";
/** A navigation or unmount cancelled the request: not a failure the user should see. */
const cancelled = (error: unknown) => error instanceof DOMException && error.name === "AbortError";
/** Worth one quiet retry: network blips and transient 5xx responses. */
const transient = (error: unknown) => !(error instanceof RequestError) || error.status >= 500;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function useResource<T>(path: string | null, interval?: number) {
  const [current, setCurrent] = useState<{ path: string; data?: T; error?: string }>();
  const active = useRef(path);
  useEffect(() => { active.current = path; }, [path]);
  const reload = useCallback(async () => {
    if (!path) return;
    try {
      let result;
      try { result = await request<T>(path); }
      catch (error) {
        if (cancelled(error) || !transient(error)) throw error;
        await pause(700);
        result = await request<T>(path);
      }
      // A successful load always clears an earlier error.
      if (active.current === path) setCurrent({ path, data: result.data });
    } catch (error) {
      if (cancelled(error) || active.current !== path) return;
      setCurrent((previous) => ({ path, data: previous?.path === path ? previous.data : undefined, error: message(error) }));
    }
  }, [path]);
  useEffect(() => {
    void reload();
    if (!interval) return;
    const timer = window.setInterval(() => { if (!document.hidden) void reload(); }, interval);
    return () => window.clearInterval(timer);
  }, [reload, interval]);
  const latest = current?.path === path ? current : undefined;
  return { data: latest?.data, error: latest?.error, pending: Boolean(path && !latest), reload };
}

export function useAction(refresh?: () => Promise<unknown>) {
  const [feedback, setFeedback] = useState({ busy: false, error: "", note: "" });
  const run = useCallback(async <T>(action: () => Promise<T>, note = "Saved.") => {
    setFeedback({ busy: true, error: "", note: "" });
    try {
      const value = await action();
      await refresh?.();
      setFeedback({ busy: false, error: "", note });
      return value;
    } catch (error) {
      setFeedback({ busy: false, error: message(error), note: "" });
      return undefined;
    }
  }, [refresh]);
  return { ...feedback, run };
}
