# SecureExam

SecureExam is the backend and a working reference portal for the PRD’s administrator, examiner, and candidate workflows. The role workspaces use the real HTTP API. The team’s separate frontend can replace the reference route group and components while keeping the backend and contracts.

## Run locally

1. Use Node.js 22.20 or newer and the pnpm version in [package.json](package.json). Run `pnpm install --frozen-lockfile`.
2. Use a development PostgreSQL database. For a disposable local session, run `pnpm exec pglite-server --host 127.0.0.1 --port 5432 --max-connections 20` (fewer connections make PGlite reset under parallel requests) in a separate terminal. Its local connection string is `postgresql://test:test@127.0.0.1:5432/postgres`. A local PostgreSQL server or a dedicated Neon database also works.
3. Set these environment variables in your shell or an ignored `.env.local` file.
   - `DATABASE_URL` provides the database connection.
   - `AUTH_SECRET` signs sessions, activation keys, and report verification codes. Generate a value with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` and keep it stable.
   - `SEED_PASSWORD` is your local demo password of 12–72 UTF-8 bytes.
   - `AUTH_URL` is the public origin for a production preview and its report links.
   - `CRON_SECRET` authorizes the optional expiry sweeper. Use a separate random value.
4. Run `pnpm db:migrate`, `pnpm db:seed`, and `pnpm dev`. Open `http://localhost:3000/login`. Sign in with `admin@example.test`, `examiner@example.test`, or `candidate@example.test` and the seed password you chose; each role lands on its own dashboard (`/admin`, `/examiner`, `/candidate`). Signed-out visits go to `/login` and other-role URLs go back to your own dashboard. The seed prints a one-time activation key for the candidate’s live exam.
5. For camera-enabled exams, run `pnpm vision:setup` before building or serving the app. The script copies the MediaPipe WebAssembly from the installed package and downloads Google’s pinned BlazeFace model. The browser loads model assets from SecureExam and performs detection on the device. Keep camera checking disabled for environments without those assets.

The database seed is for development. It creates an administrator, two examiners, 40 fictional candidates, 60 questions, and completed, live, upcoming, and practice exams. The completed midterm includes published grades, reviewed incidents, and controlled examples for item and answer-sharing analysis.

## Team integration

Use the [core contracts](src/lib/contracts/core.ts) for questions, exams, and active attempts. [Operations contracts](src/lib/contracts/operations.ts) cover admin, imports, integrity, grading, and accommodations. The [PRD](PRD.md) describes role access and the full route inventory.

- Protected JSON endpoints return `{ data }` or `{ error: { code, message, fieldErrors? } }`. Attempt endpoints also return ISO UTC `serverNow`.
- Use Auth.js credentials and same-origin requests. The session response includes the active account role. The server reloads the current role and account status for protected requests.
- Question reads require `x-exam-session-id`. Exam mutations carry the current `sessionId`. Heartbeat accepts `{ takeover: true, deviceCheck }` to resume from a desktop. A takeover invalidates the previous writer.
- Candidate answer saves take `{ sessionId, answers: [{ qid, response, seq }] }`. Use increasing per-question sequences. Flush acknowledged changes before locking or submitting.
- `GET /api/exams?id=...` gives the owning examiner the selected questions and candidate enrollment IDs. Post `{ enrollmentIds }` to the keys endpoint. Plaintext keys are returned at issuance.
- For question authoring, save an exam draft and open **Questions**. Select a section, then write a question, paste text, upload a file, or upload a ZIP. Each method saves directly to that section. Existing shared content is copied for the edited exam when needed to preserve the other exam.
- CSV question imports take `type,topic,difficulty,text,marks,options`. Use JSON choices in the options cell. JSON imports take an array of core question objects. Moodle XML and GIFT support equivalent single-choice, multiple-choice and essay items. Preview validates each row before committing valid rows. CSV also accepts `question,option_a,option_b,answer,topic,difficulty,marks`. For pasted text, number each question and put choices on separate lines (`A.`, `B.`), followed by `Answer: B` for choice questions. A ZIP can contain CSV, JSON, Moodle XML, GIFT, or TXT question files. Review identifies ZIP entries and row numbers.
- The reference portal is under `src/app/(portal)` and `src/components/backend-preview`. Replace that layout and catch-all page when merging the team’s frontend. Retain the public `/verify/[code]` page or an equivalent route at the same URL for PDF QR codes. The current frontend branch’s mock adapter must be connected to the real DTOs before using it with this backend.

## Route ownership after the frontend merge

- **Frontend (Dev B) owns the top-level pages:** `/`, `/login`, `/candidate/**`, `/examiner/**`, `/exam/**` (`src/app/(auth)`, `src/app/candidate`, `src/app/examiner`, `src/app/exam`, `src/components/{landing,ui,exam,examiner,common,bits}`, `src/lib/client`, `src/contracts`). These files are kept byte-for-byte as on the frontend branch. With `NEXT_PUBLIC_USE_MOCKS=1` they run on the in-browser mock server exactly as before; without it they call the real API.
- **Real sign-in for the frontend:** `POST /api/auth/login` (JSON email + password), `POST /api/auth/logout`, `GET /api/auth/me` return the shapes in `src/contracts/auth.ts` and use the same Auth.js session as everything else.
- **Working reference portal (backend):** `/portal/login`, `/portal/admin`, `/portal/examiner`, `/portal/candidate` (`src/app/portal`, `src/components/backend-preview`, `src/components/dashboard`). It exercises every API end to end and stays available while the frontend screens are wired to real data.
- **Public:** `/verify/[code]` (QR target in report PDFs).
- Frontend screens that still call frontend-only endpoints (for example `/api/me/exams`, `/api/attempts/:id/answers/:aq`) need to be pointed at the implemented routes listed in PRD §12; until then, use the portal for those flows.

## Two Vercel projects (frontend preview + real backend)

- **Frontend project (Fairmark, e.g. fairmark-three.vercel.app):** unchanged; deploys the frontend branch with `NEXT_PUBLIC_USE_MOCKS=1`.
- **Backend project:** import the same repository again, Production Branch `integrate/main` (or `main`), and set `SECUREEXAM_PORTAL_ONLY=1`, `DATABASE_URL`, `AUTH_SECRET`, `CRON_SECRET`, `SHOW_DEMO_ACCOUNTS=1`. In this mode `/`, `/login`, `/candidate`, `/examiner`, `/admin` and `/exam` redirect into the real system at `/portal` (see `src/proxy.ts`). The portal uses Fairmark's design tokens, fonts and light/dark theme.
- **Sign in from the Fairmark site:** in the frontend project add a redirect so its sign-in opens the backend, e.g. a `vercel.json` on the frontend branch: `{ "redirects": [{ "source": "/login", "destination": "https://<backend-domain>/portal/login", "permanent": false }] }`.

## Deploy to Vercel and test it

1. **Database.** Create a free Neon project and copy its pooled connection string. From your machine, run `DATABASE_URL=<neon url> pnpm db:migrate`, then `DATABASE_URL=<neon url> SEED_PASSWORD=<demo password> AUTH_SECRET=<same secret as Vercel> pnpm db:seed` (the seed refuses `NODE_ENV=production`, so run it locally). Keep `AUTH_SECRET` identical everywhere: it signs sessions and derives the activation keys.
2. **Vercel project settings → Environment Variables:** `DATABASE_URL`, `AUTH_SECRET`, `CRON_SECRET`, and optionally `AUTH_URL` (only to pin one canonical origin; sign-in and sign-out otherwise follow the host the request came from, so preview and production URLs both work), and `SHOW_DEMO_ACCOUNTS=1` if judges should see the demo-account shortcuts on the sign-in page.
3. **Deploy.** `vercel.json` schedules the expiry sweeper `/api/cron/finalize` daily (the Hobby plan allows one run per day; attempts are also finalized lazily on every read, so nothing depends on the cron).
4. **Check readiness.** Open `/api/health`. It returns `200 {"status":"ok"}` only when the database answers, all migrations are applied, and the required settings exist. It shows setting names, never values.
5. **Smoke test the live URL** from your machine (credentials come from your shell, not a file):

   ```bash
   SMOKE_PASSWORD=<demo password> SMOKE_EXAMINER=examiner@example.test SMOKE_CANDIDATE=candidate@example.test pnpm smoke https://<your-app>.vercel.app
   ```

   It checks health, sign-in, role isolation (401/403), the live monitor, checklist, keys, analytics and the tampered-verify case, and exits non-zero on any failure. For a protected preview deployment, also set `VERCEL_BYPASS` to the project's Protection Bypass secret.
6. **While it runs.** Watch Vercel → Project → Logs (filter by `/api/` and status 5xx). Every handled failure is logged as `SecureExam request failed: <ErrorName>` without personal data. Re-run the smoke test after every deploy and before the demo.

## Architecture and checks

```mermaid
flowchart LR
  Browser --> Routes[Next.js API routes]
  Browser --> Queue[(IndexedDB answer queue)]
  Routes --> Auth[Auth.js and current account role]
  Routes --> Services[Exam, attempt, review, grading, and analytics services]
  Services --> DB[(PostgreSQL with Drizzle)]
  Services --> PDF[PDF and QR verification]
```

Zod validates inputs at the route boundary. PostgreSQL transactions serialize attempts, answer changes, scoped grading, and result publication. Publishing freezes the eligible question pool. The server releases answer-key-free projections and stores the chosen questions and choices per attempt. Blueprint validation enforces equal achievable marks for every draw. For analytics, the pass-rate threshold is 50% and item discrimination uses the score with that item removed.

Connection gaps are measured from server heartbeat times. The server uses a five-second ordinary save grace and allows up to 120 seconds when a server-observed gap covers the deadline. Time credit is limited by the measured gap, the 25% allowance, and the exam window. The protected `/api/cron/finalize` route supports an external schedule. Attempt reads and relevant examiner views also finalize expired attempts.

Review-mode pauses and strict-mode re-attempt decisions follow the PRD. Browsers provide integrity signals for human review. Browser signals and camera consent do not establish identity or OS-level lockdown. The candidate workspace sends camera snapshots only when a configured detector reports a warning.

Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`. The HTTP integration suite runs Next.js against an isolated PostgreSQL-compatible database. For review, try cross-account access, five incorrect keys, stale session saves, unreleased questions, locked answers, duplicate submit, a strict re-attempt, publication with unreviewed work, and a changed verification code.

For a shared preview, use a dedicated free Neon database and configure a Vercel preview with its own credentials. Apply migrations to that database and keep local demo data separate from production.

## Project tooling

[skills-lock.json](skills-lock.json) pins the PRD skills. Codex and Cursor read `.agents/skills`. Claude Code has copies under `.claude/skills`. Project MCP configs pin the Playwright, Context7, and shadcn launch commands.

