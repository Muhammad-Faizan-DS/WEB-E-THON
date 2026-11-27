# SecureExam demo guide (judges, 15 minutes)

**Opening line (PRD §0):** "SecureExam is an exam platform where the server owns time, questions and marks — a dropped connection costs no one a mark, every randomized paper is equally difficult, and every integrity flag is reviewed by a human, not a machine."

## Before the judges arrive (10 minutes)

1. Open `https://<app>/api/health` → `"status":"ok"`, migrations 6/6.
2. Run `pnpm smoke https://<app>` (see README) → all checks pass.
3. Re-seed the demo database so every exam is fresh (`pnpm db:seed` against the production database URL, same `AUTH_SECRET` as Vercel).
4. Open three browser profiles (or one normal + two private windows), one per role, so you never sign out during the demo:
   - **Admin:** `admin@example.test`
   - **Examiner:** `examiner@example.test`
   - **Candidate:** `candidate@example.test` (desktop browser, Chrome or Edge)
   - Password: the demo password from the README / seed settings. Sign in at **`/portal/login`** (the "+ Demo accounts" link fills the email).
5. Examiner window: open **SecureExam Live Exam → Candidates & keys** and copy Candidate 01's key.

The marketing site and redesigned screens (frontend) live at `/` and `/login`; the complete working flows run in the portal at `/portal/...`.

## Walkthrough by portal

### 1. Examiner portal (`/portal/examiner`) — build and publish (3 min)
- **Exams** list → open an exam → **Questions**: sections (A — MCQ, B — Written); add a question by hand, paste text, or upload CSV / JSON / Moodle XML / GIFT / ZIP with a row-error preview.
- **Settings** → exam type presets (Practice / Quiz / Assignment / Midterm / Final), integrity mode, open-question limit, sequential reveal, camera check.
- **Publish checklist** explains the paper: "draws 2 of 5 questions per candidate, seeded by their activation key".
- **Sandbox preview** (not recorded).
- **Candidates & keys**: enrol by email; every candidate gets a **personal key** automatically. Say: *"The key both unlocks the exam and seeds that candidate's paper — same key, same paper; different keys, different papers, all with equal difficulty."* Show Copy / CSV / Print.

### 2. Candidate portal (`/portal/candidate`) — take the exam (4 min)
- Dashboard: Available / Upcoming / Completed, notification bell.
- Open **SecureExam Live Exam** → paste the key → start screen with the rules → **3-2-1** → fullscreen.
- In the workspace: exam title, watermark (name + short ID), big server timer, "Saved ✓" chip, section headers in the palette.
- Answer, **Lock** a question, hit the **open-question limit** message.
- **Refresh the page** → same answers, same time, same position.
- DevTools → Network → **Offline** → change an answer → chip shows "Offline · 1 queued" → back **Online** → "Saved ✓".
- **Ask examiner** with a short note (shows on the examiner's tile).
- Press **Esc** (leaves fullscreen) → strict mode voids the attempt and sends a re-attempt request (step 4).
- Optional: **Arithmetic — practice** needs no key and shows the score instantly after submit, with QR verification on **Results**.

### 3. Examiner portal — Live monitor (2 min)
- One screen: counts bar, candidate tiles (progress, time left, online dot, ✋, amber/red badges), **Needs attention** filter, alerts inbox.
- Click Candidate 01's tile → side panel: incident timeline (with camera frames when camera check is on), **Cleared / Confirmed**, private reply (lowers the hand), time credit capped at server-measured offline time, raise open limit.
- **All candidates** menu → announcement (shows "n of m read") and **Extend end time**.
- Camera exams: several people in view → **red priority** incident; no face for **10 minutes** → attempt voided and sent for human review.

### 4. Admin portal (`/portal/admin`) — oversight (2 min)
- **Re-attempt requests**: the examiner forwarded the voided attempt (examiner cannot approve — 403); admin **approves** with a reason → 15-minute cooldown → new key → new attempt with 50 % new questions.
- **Users**: paging, role filter, "…" menu (reset password, deactivate); your own row is locked ("You"), the server refuses self-demotion.
- **Disputes**: a candidate's dispute about their examiner reaches admins only.
- **Audit log**: every privileged action, including the text of messages examiners sent.

### 5. Grading, results and analytics (3 min) — examiner `Midterm — completed`
- **Grading & results**: written answers with edit timeline; publishing is blocked until all written answers are graded and incidents reviewed; regrade needs a reason.
- Candidate **Results**: score, percentage, question text, **QR** → `/verify/<code>` (masked name, valid / not valid; change one character → "not verified").
- **Analytics**: red **"Check answer key"** item, fairness chart (*"Blueprint ±3 % vs random ±6 %"*), the planted **answer-sharing pair** (Candidate 09 and 10), Moodle CSV.

### 6. Security proof (1 min)
- As the candidate, open another candidate's result or `/api/exams` → **403**.
- Network tab while answering: no answer keys in any response.
- Double-click Submit → exactly one submission.

**Close with the honest limits (PRD §9):** a browser cannot see other apps or second devices; client blocks can be bypassed with DevTools; the server rules and human-reviewed evidence are the real enforcement.

## PRD feature checklist (status 27 Nov)

Legend: ✅ built and covered by automated tests · 🟢 built, checked by hand · 🟡 partial · ⬜ not built

| PRD | Feature | Status |
|---|---|---|
| §4, BR-01 | Server-side role + ownership on every route; deactivated user loses access next request | ✅ |
| §24.2 | Institution accounts, no public sign-up, external invites, audited role changes, self-lockout guard | ✅ |
| Phase 1 | Sections; manual / paste / CSV / JSON / Moodle XML / GIFT / ZIP authoring with row errors | ✅ |
| Phase 1, §24.3 | Exam types + presets API, checklist with paper summary, sandbox | ✅ |
| §24.3 | Step-by-step creation wizard with type cards | ⬜ (single settings form) |
| Phase 1 | Enrol by email, extra time, paste accommodation, auto per-candidate keys, CSV / print | ✅ |
| BR-04 | Paper seeded by the candidate's activation key, drawn by blueprint within sections | ✅ |
| Phase 2 | Dashboard buckets, desktop-only start (BR-18), 5 wrong keys → locked, start screen + 3-2-1 | ✅ |
| Phase 3 | Server timer, palette, watermark, autosave, lock (409), flag, sequential reveal, open limit | ✅ |
| Phase 3 | Copy / paste / right-click blocked and logged; prefs; scratchpad; shortcuts | 🟢 |
| Phase 4 | Refresh resume, second-tab takeover (409 SESSION_SUPERSEDED), lazy finalize, idempotent submit | ✅ |
| Phase 4 | Offline queue (IndexedDB) and reconnect sync | 🟢 (not re-tested on the deployed URL) |
| Phase 4 | Standard / review / strict departure handling; strict → void → examiner → admin → cooldown → 50 % new paper → 2nd strike blocked | ✅ |
| Phase 4, §24.5 | Camera check: consent, warnings + 3-frame bursts, multiple people = priority, 10 min absent = void for review | ✅ (live camera not demoed yet) |
| Phase 5 | Submit summary with jump links, confirmation, instant practice result | 🟢 |
| Phase 6 | One-screen live monitor, alerts inbox, incident cards, Cleared/Confirmed, announcements with read counts, time credit, open limit, raise hand | ✅ |
| Phase 7 | Auto-grade (3 multi-select rules), written grading, publish gate, regrade with reason, results, PDF, QR verify | ✅ |
| Phase 8 | Summary, item stats + flags, fairness simulation, collusion pairs, Moodle CSV | ✅ |
| Phase 9 | Admin approve / reject, unblock, audit log with message text | ✅ |
| New | Notification bell (all portals), disputes (admin-only when about the examiner), remove candidate with reason | ✅ |
| §11 | All 8 secondary features (network UI, PDF, sandbox, bulk import, item analytics, verifiable reports, custom workspace, scratchpad) | ✅ / 🟢 |
| §2.5 | Close exam now, connectivity test (`/api/ping`), examiner-only notes, per-attempt +minutes extension | ⬜ (window extension and gap-capped credit exist) |
| Frontend | Real sign-in for the new UI (`/api/auth/login`, `/logout`, `/me`); mocks removed | ✅ |
| Frontend | New UI screens (`/candidate`, `/examiner`, `/exam`) on real data | 🟡 still call frontend-only endpoints; use `/portal` for the demo |
| Deploy | `/api/health`, `pnpm smoke`, daily cron, Vercel guide | ✅ (production database not yet connected) |
