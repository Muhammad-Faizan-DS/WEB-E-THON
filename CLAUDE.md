# CLAUDE.md

This replaces any earlier `CLAUDE.md`. The shared rules for all agents live in `AGENTS.md` and are imported here, so edit them there, not in this file.

@AGENTS.md

## Claude Code specifics

- **Read `PRD.md` sections on demand.** It is long, so open the section your task names (for example §7 business rules, §11 contracts, §12 API list, §16 tests) instead of reading it all.
- **Which dev am I working for?** Check the branch: `be/*` means Dev A (backend scope), `fe/*` means Dev B (frontend scope). On `main` or anything unclear, ask before editing.
- **Skills:** use `frontend-design` for any new page or component (Dev B). Use `webapp-testing` when verifying T-cases in a browser.
- **MCP servers:** `shadcn` (add/inspect components, never hand-copy them), `playwright` (drive the Vercel preview or localhost for T-cases, screenshots at 375px and 1280px), `context7` (current docs for Next.js 16, Drizzle, Tailwind v4, shadcn, pdf-lib).
- **Plan mode** for anything that touches more than 3 files or any business rule (BR-xx). Show the plan, wait for approval, then implement.
- **Definition of done:** `pnpm typecheck && pnpm lint && pnpm test` pass. The relevant T-ids are checked. UI work has screenshots. The PR template is filled in.
- Do not create new markdown docs unless asked. Update `PRD.md` only when the human asks, and only via a PR.
