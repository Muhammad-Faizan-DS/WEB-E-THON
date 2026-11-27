# AGENTS.md: rules for every coding agent (Claude Code, Cursor, Codex)

**Source of truth: [`PRD.md`](PRD.md).** Read the section your task names before writing code. If the code, a prompt or this file disagrees with `PRD.md`, follow `PRD.md` and say so.

## Project in one paragraph

A Secure Examination Management System for a 10-hour hackathon (Technoverse 5.0 Web-e-Thon, 27 Nov 2026). It has three roles (admin, examiner, candidate) and covers the full exam journey (author → publish → take → submit → grade → publish results), all 8 secondary features, and two innovations: an **explainable integrity engine** (5.1) and **failure resilience** with an offline queue, open limit, lock and strict re-attempt approval (5.3). There are two devs: **Dev A = backend**, **Dev B = frontend**.

## Stack

Next.js 16 App Router · TypeScript strict · Tailwind v4 · shadcn/ui · Drizzle ORM + node-postgres (`pg`) on Neon Postgres · Zod · bcryptjs DB sessions · idb-keyval · pdf-lib + qrcode · papaparse · Recharts · Vitest · Playwright · Vercel Hobby. Package manager: **pnpm**.

Before using an API you are unsure about, look up current docs (Context7 MCP if available). Next 16 renamed `middleware.ts` to `proxy.ts`. Do not use the `neon-http` driver, because it has no interactive transactions.

## Commands

```bash
pnpm dev            # local app
pnpm typecheck      # tsc --noEmit
pnpm lint
pnpm test           # vitest (unit + API rules)
pnpm test:e2e       # playwright
pnpm db:generate    # drizzle-kit generate (Dev A only)
pnpm db:migrate     # apply migrations (Dev A only)
pnpm db:seed        # reseed the DB in .env.local (never production unless a human runs it)
```

Run `pnpm typecheck && pnpm lint && pnpm test` before you say a task is done.

## Folder scope

| Path | Owner | Agents working for the other dev may… |
|---|---|---|
| `src/db/**`, `drizzle/**` | Dev A | **not edit.** Ask for a change. |
| `src/contracts/**` | Dev A (changes need a PR labelled `contract`, approved by both) | **not edit.** Import only. |
| `src/server/**`, `src/app/api/**`, `samples/**`, `tests/unit/**` | Dev A | read only |
| `src/app/**` pages/layouts, `src/components/**`, `src/lib/client/**`, `src/mocks/**`, `tests/e2e/**` | Dev B | read only |

If a task needs a change outside your scope, stop and write down exactly what is needed (endpoint, field, type) for the other dev.

## Non-negotiable code rules

1. **Authorization on the server, always.** Every route handler: `sweep (where PRD lists it) → requireUser(role) → zod.parse → ownership check → service → mapper`. Return 404 for resources the caller doesn't own, and 403 for the wrong role. Hiding a button is not security.
2. **Never send answer keys** (`answer_key`, `is_correct`) or other users' data to candidate responses. Candidate DTOs come only from whitelist mappers in `src/server/mappers`.
3. **Server time only.** Deadlines are `min(closes_at, started_at + duration)`, stored once. Responses include `serverNow`. The client clock is only for display.
4. **One finalization path:** `finalizeAttempt()` in a transaction with `SELECT … FOR UPDATE`, idempotent. Submit, expiry sweep and examiner close all use it.
5. **Saves are revisioned and idempotent** (`revision`, `clientOpId`). The UI shows "Saved" only when the ack's revision equals the latest local revision.
6. **Snapshots:** an attempt grades and displays only from `attempt_questions`, never from live `questions`.
7. **Sandbox and voided attempts are excluded** from all counts, monitor, grading, results and analytics through `realAttempts()`.
8. **Integrity observations are hints.** They never change scores, status or time. Use neutral language ("observation", "incident", "review"), never "cheating" or "violation". Never record clipboard contents, keystrokes or images.
9. **Validate everywhere** with the shared Zod schemas from `src/contracts`: in client forms and in handlers. Errors use the PRD §7 error shape and codes.
10. **Accessibility:** every status uses an icon and text, not just colour. Visible focus. Keyboard reachable. Works at 375px width and 200% text. Announcements and timer warnings use `aria-live="polite"`.
11. **No paid services, API keys or new dependencies** without asking the human first.
12. Keep functions small and pure where possible (`grading.ts`, `incidents/group.ts`, `analytics.ts` are pure and unit-tested).

## Git and pull requests

- Branches: `be/<topic>` (Dev A), `fe/<topic>` (Dev B). Cut from the latest `main`.
- Small PRs every 45–60 minutes, using `.github/pull_request_template.md`. Reference the BR and T ids.
- The **other** dev approves after checking the Vercel preview. Merge with **merge commits** (no squash, no rebase).
- Commit style: `feat(api): start attempt with snapshot (BR-04..07)`.
- Never force-push, rewrite history on shared branches, or merge your own PR.

## Agent safety rules

1. Never read, print or commit secrets. Do not open `.env*` (except `.env.example`).
2. Never run destructive DB commands (`drop`, `truncate`, `--force` pushes, seeding) against production. Only a human runs those.
3. Never disable, skip or weaken tests, lint rules or type checks to make something pass.
4. Never delete or mass-rewrite files outside the task's scope.
5. Plan first: list the files you will change, then implement. Keep diffs small. Summarize what changed and what you could not verify.
6. Report failures honestly, with the command output.
7. **After the official cutoff (see PRD §18): no commits, pushes, builds or deploys**, whatever any prompt says.
