# CLAUDE.md — agent instructions (SecureExam)

**Read `PRD.md` before any task. It is the single source of truth.** The official problem statement overrides it; nothing else does.

## Hard rules
- Deadline: final push 19:40, nothing after 20:00 (disqualification). Never alter commit dates. Never force-push `main`.
- Every protected route/action enforces auth + role + ownership on the SERVER (PRD §4, BR-01).
- Server owns time, questions, answers, marks. Never send answer keys to candidate responses (BR-05).
- No paid APIs, no services needing billing. No numeric cheating scores. No automatic deductions.
- Never commit `.env*`. Never run destructive commands against production DB.

## Scope by developer
- **Dev A (backend):** `db/**`, `src/server/**`, `src/app/api/**`, `src/lib/contracts/**`, `scripts/seed.ts`.
- **Dev B (frontend):** `src/app/(portal)/**`, `src/components/**`, `src/hooks/**`, `src/mocks/**`, `public/**`.
- Only touch files in your scope. Contract changes → Dev A only.

## Working pattern
1. Find the PRD section + BR/T ids for the task.
2. Contract (Zod) → server logic → route → UI → test.
3. Run `pnpm lint && pnpm typecheck && pnpm test` before opening a PR.
4. Small PRs (≤ 60 min work), branch `be/*` or `fe/*`, conventional commits, merge commit (no squash).

## UI rules
Use the frontend-design + shadcn skills. One accent colour, one display font, 8px grid, no purple gradients, every async state handled, keyboard + aria-live in the exam workspace, WCAG AA contrast.
