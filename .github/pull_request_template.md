## What and why

<!-- One or two sentences. Link the PRD section. -->

- PRD: §
- Business rules: BR-
- Tests covered: T

## Type

- [ ] `be/*` backend (Dev A)
- [ ] `fe/*` frontend (Dev B)
- [ ] `contract` (changes `src/contracts`, so **both devs must approve**)
- [ ] Schema / migration (Dev A only)

## How to test on the Vercel preview

1. Log in as `…@exam.test` / `Demo@2026`
2. …
3. Expected: …

## Checklist

- [ ] Small and focused (about 45–60 minutes of work)
- [ ] Stays inside my folder scope (AGENTS.md)
- [ ] `pnpm typecheck && pnpm lint && pnpm test` pass locally
- [ ] Every new or changed API route: `requireUser` + Zod + ownership check (404 if not owned)
- [ ] No answer keys or other users' data in candidate responses (whitelist mapper)
- [ ] Uses server time; no client clock in rules
- [ ] Inputs validated on client **and** server with the shared Zod schema
- [ ] UI: loading, empty and error states; icon and text for status; keyboard and focus OK; checked at 375px and 1280px
- [ ] No secrets, no `.env` changes, no new dependency without agreement
- [ ] Screenshots attached (UI) or example request and response (API)

## Reviewer (the other dev)

- [ ] Opened the Vercel preview and followed "How to test"
- [ ] Merge with **"Create a merge commit"** (no squash, no rebase)
