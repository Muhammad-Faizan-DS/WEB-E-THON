"use client";
/**
 * Proctoring additions from the exam-portal guide (frontend side). These shapes live here, not in
 * src/contracts (Dev A's), until the backend endpoints exist; PRD §2.5 lists what Dev A needs to build.
 * These call the real API (the mock server was removed).
 */
import * as React from "react";
import { z } from "zod";
import { api } from "./api";

export const HelpCategory = z.enum(["question", "technical", "break"]);
export type HelpCategory = z.infer<typeof HelpCategory>;
export const HELP_LABEL: Record<HelpCategory, string> = { question: "Question about the exam", technical: "Technical problem", break: "Need a short break" };

export const ProctorMessage = z.object({
  id: z.string(),
  examId: z.string(),
  attemptId: z.string(),
  from: z.enum(["examiner", "candidate"]),
  kind: z.enum(["message", "reminder", "help"]),
  category: HelpCategory.nullable(),
  body: z.string(),
  createdAt: z.iso.datetime(),
  by: z.string(),
  resolvedAt: z.iso.datetime().nullable(),
});
export type ProctorMessage = z.infer<typeof ProctorMessage>;

export const Extension = z.object({
  id: z.string(), examId: z.string(), attemptId: z.string().nullable(), minutes: z.number().int(),
  reason: z.string(), by: z.string(), at: z.iso.datetime(), affected: z.number().int(),
});
export type Extension = z.infer<typeof Extension>;

/** GET /api/exams/{id}/proctor (examiner) */
export const ProctorState = z.object({
  serverNow: z.iso.datetime(),
  instructions: z.string(),
  notes: z.string(),
  closedAt: z.iso.datetime().nullable(),
  messages: z.array(ProctorMessage),
  extensions: z.array(Extension),
  acks: z.record(z.string(), z.object({ acked: z.number().int(), total: z.number().int(), missing: z.array(z.string()) })),
});
export type ProctorState = z.infer<typeof ProctorState>;

/** GET /api/attempts/{id}/inbox (candidate) */
export const Inbox = z.object({ messages: z.array(ProctorMessage), acked: z.array(z.string()) });
export type Inbox = z.infer<typeof Inbox>;

export const MessageCreate = z.object({ body: z.string().trim().min(1, "Write a message").max(500, "Keep it under 500 characters"), kind: z.enum(["message", "reminder"]) });
export const ExtendCreate = z.object({
  minutes: z.number().int().min(1, "At least 1 minute").max(60, "At most 60 minutes"),
  reason: z.string().trim().min(5, "Add a reason for the record (at least 5 characters)").max(300),
});
export const CloseCreate = z.object({ reason: z.string().trim().min(5, "Add a reason for the record (at least 5 characters)").max(300) });
export const HelpCreate = z.object({ category: HelpCategory, body: z.string().trim().min(3, "Tell your examiner what you need").max(500, "Keep it under 500 characters") });
export const IssueCategory = z.enum(["connectivity", "content", "candidate", "platform", "other"]);
export const ISSUE_LABEL: Record<z.infer<typeof IssueCategory>, string> = {
  connectivity: "Connectivity", content: "Question or answer key", candidate: "A candidate", platform: "Fairmark itself", other: "Something else",
};
export const IssueCreate = z.object({ category: IssueCategory, body: z.string().trim().min(10, "Describe the issue in a sentence or two").max(1000), examId: z.string().optional() });
export const Issue = z.object({ id: z.string(), examId: z.string().nullable(), category: z.string(), body: z.string(), by: z.string(), role: z.string(), at: z.iso.datetime() });
export const IssueList = z.object({ issues: z.array(Issue) });
export type Issue = z.infer<typeof Issue>;

/** Open help requests per attempt, newest first. */
export function openHelpByAttempt(messages: ProctorMessage[]) {
  const map: Record<string, ProctorMessage[]> = {};
  for (const m of messages) if (m.kind === "help" && !m.resolvedAt) (map[m.attemptId] ??= []).push(m);
  return map;
}

/**
 * Candidate inbox: polls every 10 s while the attempt is open. Returns examiner messages, own help
 * requests and which announcements were acknowledged; `unread` counts examiner messages not yet seen.
 */
export function useInbox(attemptId: string, enabled: boolean) {
  const [inbox, setInbox] = React.useState<Inbox>({ messages: [], acked: [] });
  const [seen, setSeen] = React.useState<number>(0);
  const load = React.useCallback(async () => {
    try { setInbox(await api.get(`/api/attempts/${attemptId}/inbox`, Inbox)); } catch { /* offline: keep last known */ }
  }, [attemptId]);
  React.useEffect(() => {
    if (!enabled) return;
    const first = setTimeout(load, 0);
    const t = setInterval(load, 10_000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [enabled, load]);
  const fromExaminer = inbox.messages.filter((m) => m.from === "examiner");
  const unread = Math.max(0, fromExaminer.length - seen);
  const markRead = React.useCallback(() => setSeen(fromExaminer.length), [fromExaminer.length]);
  return { inbox, reload: load, unread, markRead, latestFromExaminer: fromExaminer.at(-1) ?? null };
}
