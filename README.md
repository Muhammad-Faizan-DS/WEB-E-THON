# Fairmark

**Exams you can trust, even when the Wi-Fi can't.** A secure online examination system built for Technoverse 5.0 Web-e-Thon (COMSATS Lahore, 27 Nov 2026).

**Live demo: https://fairmark-three.vercel.app**

The server keeps the clock, every answer gets a receipt, and a person (not a machine) decides what an integrity observation means.

---

## Demo logins

Every account uses the same password: **`Demo@2026`**

| Role | Email | What you'll see |
|---|---|---|
| Admin | `admin@exam.test` | Accounts (search, disable/re-enable, one-time password reset) and the audit log |
| Examiner | `examiner@exam.test` | Dashboard, **New exam** builder, live monitor, requests, incidents |
| Examiner 2 | `examiner2@exam.test` | A second examiner, who can only see their own exams |
| Candidate | `ali@exam.test` | Two open exams, one upcoming, one published result (76.7%) |
| Candidate | `sara@exam.test` | A second candidate with a published result (83.3%) |
| Candidate | `omar@exam.test` | A third candidate |

**Shortcuts:**
- The homepage has **Try it as Candidate / Examiner / Admin** links that pre-fill the login.
- The login page lists the demo accounts, and one click fills them in.

**Identity check (candidates).** Before a timed exam starts, the candidate confirms their student ID and password once:

| Candidate | Student ID |
|---|---|
| Ali Khan | `FA23-BCS-001` |
| Sara Ahmed | `FA23-BCS-002` |
| Omar Farooq | `FA23-BCS-003` |

---

## A 10-minute tour for judges

Use two browser windows (or one normal and one private window) so the examiner and the candidate can watch each other.

1. **Examiner builds and publishes an exam.**
   - Sign in as `examiner@exam.test`, then click **New exam**.
   - Add a single-choice, a multiple-select and a written question, tick Ali under **Candidates**, then **Publish**.
   - Try **Publish** with something missing: you get a list of exactly what to fix.
   - **Save draft** keeps unfinished work. The draft's page has **Edit draft** and **Publish**.
2. **Candidate takes it.**
   - Sign in as `ali@exam.test` and open the exam.
   - Read the rules, tick the consent box, then verify identity with `FA23-BCS-001` and `Demo@2026`. **Start** unlocks only after that.
3. **Lose the connection on purpose.**
   - Answer a question, then go offline (DevTools → Network → Offline).
   - Change an answer. The status reads **Saved on this device · 1 waiting**.
   - Go back online. It syncs, and the status shows **Saved** only when the server's receipt matches your latest edit.
4. **Try to look elsewhere.** Switch to another window or tab. The question is covered until you come back, and the time away is noted for the examiner. Copying question text is blocked on strict exams.
5. **Submit and read the receipt.** It shows a receipt code, how the exam ended, and, question by question, which saved version counted. Edits that didn't reach the server in time are listed. The receipt survives closing the tab.
6. **Examiner side.**
   - **Monitor** shows who is working, offline, locked or asking for help.
   - Open **Manage** on a candidate to reply, add time with a recorded reason, or **Mark resolved** on a help request.
   - **Timeline** shows grouped incidents with plain-language explanations. **Dismiss** and **Follow up** never change marks.
7. **Admin.**
   - Sign in as `admin@exam.test`, then **Reset password** for Sara.
   - Sign in as Sara with the old password: it's rejected. The temporary password only lets her choose a new one, and it can't be used twice.
   - Everything lands in the **Audit log**.

### Other things to try
- **Time runs out while offline:** Ali's **Expiry Demo Quiz** lasts 2 minutes.
  - At 00:00 the screen says *Time's up*, and offline it explains what will count.
  - When you reconnect, it goes straight to the receipt.
- **Open the same exam in a 4th tab or device.** The attempt locks, the questions hide and the timer keeps running. The candidate can ask the examiner to unlock it.
- **Published results:** Ali → **Completed** → **View result** → **Print or save as PDF**.
- **Light and dark themes:** the sun/moon toggle in every header. The choice is saved to the account.
- **Workspace settings (candidate):** text size, layout, navigator position, theme and reduced motion.

---

## How the demo data works

This deployment runs on an **in-browser mock API** (`NEXT_PUBLIC_USE_MOCKS=1`). It implements the PRD's business rules:
- server-fixed deadlines;
- revisioned, idempotent saves;
- the open limit and lock;
- one finalization path for submit, expiry and examiner close;
- incident grouping;
- requests, announcements and the audit log.

State lives in your browser's `localStorage`:
- each browser has its own data, and a refresh behaves like a real server;
- exams you create appear for the enrolled candidates in the same browser;
- to start fresh, run `window.__mock.reset()` in the browser console;
- to simulate "server unreachable while Wi-Fi is up", run `localStorage.setItem("mock:unreachable", "1")`, and remove it to recover.

---

## What's inside

**Core flow:** author → publish → verify identity → take → submit → review → grade → publish results, for three roles: admin, examiner and candidate.

**Integrity, explained (innovation 5.1)**
- The exam only notes what candidates were told about at the start: leaving the page or fullscreen, blocked pastes, and dropped connections.
- These observations are grouped into incidents with a plain explanation, and a person decides.
- Observations never change marks, status or time.
- Clipboard text, keystrokes, screenshots, camera images and other tabs' addresses are never collected.

**Failure resilience (innovation 5.3)**
- The deadline is fixed on the server; refreshing, a new device or a changed clock can't move it.
- An offline answer queue lives on the device and is retried until the server confirms it.
- An honest receipt shows what counted.
- Tab takeover shows the server's copy.
- If the server is unreachable, the screen says so and keeps your place instead of signing you out.
- The strict re-attempt request flow keeps the original attempt on record.

**Secondary features in this build**
- A network-aware interface.
- Workspace preferences.
- A scratchpad (never graded).
- A result page with print-to-PDF.
- Admin account management and the audit log.

---

## Run it locally

```bash
pnpm install
NEXT_PUBLIC_USE_MOCKS=1 NEXT_PUBLIC_DEMO_HINTS=1 pnpm dev
```

Open http://localhost:3000 and use the logins above.

| Command | What it does |
|---|---|
| `pnpm dev` | Start the app |
| `pnpm typecheck` | TypeScript, strict |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest unit tests |
| `pnpm build` | Production build |

**Stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui (Radix), Zod, motion, Vanta (three.js) for the hero, idb-keyval for the offline queue, Vitest. Hosted on Vercel.

---

## Honest limits

- **This deployment uses demo data in the browser, not a shared database.** The database-backed API is being built separately (Dev A, branch `be/secureexam-backend`) against the same PRD. The client-side shapes it still needs are in `src/lib/client/{admin,authoring,results,proctor}.ts`.
- **A website can't lock a computer.** Questions hide when the exam isn't the window in front, copying is blocked and time away is noted. Safe Exam Browser and OS lockdown are out of scope (PRD §21).
- **Not built yet:**
  - a grading screen for written answers;
  - question-bank search across exams;
  - the optional on-device camera presence check (PRD §8, which needs an extra library);
  - a generated PDF with a public verification page (results use the browser's print-to-PDF);
  - a sandbox preview for examiners.

## Project docs

- [`PRD.md`](PRD.md): the source of truth for requirements and business rules.
- [`DESIGN.md`](DESIGN.md): the visual system.
- [`AGENTS.md`](AGENTS.md): working rules for contributors and coding agents.
