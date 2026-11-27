#!/usr/bin/env node
// Post-deploy smoke test. Usage:
//   node scripts/smoke.mjs https://your-app.vercel.app
// Optional signed-in checks (values come from your shell, never from this file):
//   SMOKE_PASSWORD=... SMOKE_EXAMINER=examiner@example.test SMOKE_CANDIDATE=candidate@example.test node scripts/smoke.mjs <url>
// Preview deployments behind Vercel Deployment Protection also need VERCEL_BYPASS=<protection bypass secret>.
const base = (process.argv[2] ?? process.env.SMOKE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const bypass = process.env.VERCEL_BYPASS ? { "x-vercel-protection-bypass": process.env.VERCEL_BYPASS } : {};
const results = [];

async function call(path, { cookie, method = "GET", body, headers = {} } = {}) {
  const started = Date.now();
  const response = await fetch(base + path, { method, redirect: "manual", body,
    headers: { ...bypass, ...(cookie ? { cookie } : {}), ...headers } });
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { json = undefined; }
  return { status: response.status, json, ms: Date.now() - started, cookies: response.headers.getSetCookie?.() ?? [] };
}

async function check(name, run) {
  try {
    const detail = await run();
    results.push({ ok: true, name, detail: detail ?? "" });
  } catch (error) {
    results.push({ ok: false, name, detail: error instanceof Error ? error.message : String(error) });
  }
}

function expect(condition, message) { if (!condition) throw new Error(message); }
const jar = (cookies) => cookies.map((cookie) => cookie.split(";")[0]).join("; ");

async function signIn(email) {
  const csrf = await call("/api/auth/csrf");
  const login = await call("/api/auth/callback/credentials", {
    method: "POST", cookie: jar(csrf.cookies), headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ csrfToken: csrf.json?.csrfToken ?? "", email, password: process.env.SMOKE_PASSWORD ?? "" }),
  });
  const cookie = jar([...csrf.cookies, ...login.cookies]);
  expect(/session-token=/.test(cookie), `sign-in failed for ${email} (HTTP ${login.status})`);
  return cookie;
}

await check("Health: database, migrations, settings", async () => {
  const { status, json, ms } = await call("/api/health");
  expect(status === 200 && json?.status === "ok", `HTTP ${status} ${JSON.stringify(json?.checks ?? json)}`);
  return `db ${json.checks.database.latencyMs} ms · migrations ${json.checks.migrations.applied}/${json.checks.migrations.expected} · commit ${json.deployment.commit ?? "local"} · ${ms} ms`;
});
await check("Sign-in page renders", async () => {
  const { status, ms } = await call("/login");
  expect(status === 200, `HTTP ${status}`);
  return `${ms} ms`;
});
await check("Protected API refuses anonymous calls (BR-01)", async () => {
  const { status } = await call("/api/exams");
  expect(status === 401, `expected 401, got ${status}`);
});
await check("Tampered verify code is not valid (T27)", async () => {
  const { json } = await call("/api/verify/" + "0".repeat(40));
  expect(json?.data?.valid === false, `unexpected ${JSON.stringify(json)}`);
});

if (process.env.SMOKE_PASSWORD && process.env.SMOKE_EXAMINER) {
  let cookie;
  await check("Examiner signs in", async () => { cookie = await signIn(process.env.SMOKE_EXAMINER); });
  if (cookie) {
    let exams = [];
    await check("Examiner lists exams", async () => {
      const { status, json, ms } = await call("/api/exams", { cookie });
      expect(status === 200, `HTTP ${status}`);
      exams = json.data;
      return `${exams.length} exams · ${ms} ms`;
    });
    const live = exams.find((exam) => exam.status === "published") ?? exams[0];
    if (live) {
      for (const [label, path] of [["Live monitor", "/monitor"], ["Publish checklist", "/checklist"], ["Candidate keys", "/keys"], ["Analytics", "/analytics"]]) {
        await check(`${label} for "${live.title}"`, async () => {
          const { status, ms, json } = await call(`/api/exams/${live.id}${path}`, { cookie });
          expect(status === 200, `HTTP ${status} ${json?.error?.code ?? ""}`);
          return `${ms} ms`;
        });
      }
    }
    await check("Examiner cannot use admin API (role check)", async () => {
      const { status } = await call("/api/admin/users", { cookie });
      expect(status === 403, `expected 403, got ${status}`);
    });
  }
}

if (process.env.SMOKE_PASSWORD && process.env.SMOKE_CANDIDATE) {
  let cookie;
  await check("Candidate signs in", async () => { cookie = await signIn(process.env.SMOKE_CANDIDATE); });
  if (cookie) {
    await check("Candidate dashboard API", async () => {
      const { status, json, ms } = await call("/api/candidate/exams", { cookie });
      expect(status === 200, `HTTP ${status}`);
      return `${json.data.available.length} available · ${ms} ms`;
    });
    await check("Candidate cannot read examiner data (403)", async () => {
      const { status } = await call("/api/exams", { cookie });
      expect(status === 403, `expected 403, got ${status}`);
    });
  }
}

console.log(`\nSecureExam smoke test → ${base}\n`);
for (const { ok, name, detail } of results) console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
const failed = results.filter(({ ok }) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
process.exitCode = failed ? 1 : 0;
