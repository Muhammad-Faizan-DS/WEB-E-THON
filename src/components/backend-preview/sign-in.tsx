"use client";

import { signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

const demoAccounts = [
  ["Administrator", "admin@example.test"],
  ["Examiner", "examiner@example.test"],
  ["Candidate", "candidate@example.test"],
] as const;

const promises = [
  ["Server-owned time", "A dropped connection never costs a candidate a mark."],
  ["Equal papers", "Every randomized paper follows the same blueprint."],
  ["Human review", "Integrity signals are reviewed by people, never auto-penalised."],
] as const;

export function SignInPanel({ showDemoAccounts = false, institution = "SecureExam" }: { showDemoAccounts?: boolean; institution?: string }) {
  const router = useRouter();
  const email = useRef<HTMLInputElement>(null);
  const password = useRef<HTMLInputElement>(null);
  const [state, setState] = useState({ busy: false, message: "" });
  const [reveal, setReveal] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setState({ busy: true, message: "" });
    try {
      const result = await signIn("credentials", { email: data.get("email"), password: data.get("password"), redirect: false });
      if (!result?.ok || result.error) {
        setState({ busy: false, message: "That email and password don't match an active account." });
        password.current?.select();
        return;
      }
      // "/" resolves the signed-in role on the server and redirects to /admin, /examiner or /candidate.
      router.replace("/");
      router.refresh();
    } catch {
      setState({ busy: false, message: "SecureExam could not be reached. Check your connection and try again." });
    }
  }
  function fillDemo(address: string) {
    if (email.current) email.current.value = address;
    password.current?.focus();
  }
  return <main className="sign-in">
    <section className="sign-in-brand" aria-label="About SecureExam">
      <div className="brand"><span aria-hidden="true">SE</span>SecureExam</div>
      <div className="sign-in-pitch">
        {institution !== "SecureExam" && <p className="eyebrow">{institution}</p>}
        <h1>Exams that stay fair when things go wrong.</h1>
        <ul className="promises">{promises.map(([title, text]) => <li key={title}><strong>{title}</strong><span>{text}</span></li>)}</ul>
      </div>
      <p className="sign-in-foot">Accounts are issued by your institution. There is no public sign-up.</p>
    </section>
    <section className="sign-in-form"><form onSubmit={submit} noValidate={false}>
      <div><h2>Sign in</h2><p>Use the email address your institution registered for you.</p></div>
      <label>Email<input ref={email} required name="email" type="email" autoComplete="username" inputMode="email" spellCheck={false} /></label>
      <label>Password<span className="password-field">
        <input ref={password} required name="password" type={reveal ? "text" : "password"} autoComplete="current-password" />
        <button type="button" className="ghost" aria-pressed={reveal} aria-label={reveal ? "Hide password" : "Show password"} onClick={() => setReveal((value) => !value)}>
          {reveal ? "Hide" : "Show"}</button></span></label>
      {state.message && <p role="alert" className="error">{state.message}</p>}
      <button disabled={state.busy} className="primary">{state.busy ? "Signing in…" : "Sign in"}</button>
      <p className="muted small">Forgotten your password? Ask your exam administrator to reset it.</p>
      {showDemoAccounts && <details className="demo-accounts">
        <summary>Demo accounts</summary>
        <div className="actions">{demoAccounts.map(([label, address]) =>
          <button key={address} type="button" onClick={() => fillDemo(address)}>{label}</button>)}</div>
        <small>Fills the email. Use the demo password from the README or your seed settings.</small>
      </details>}
    </form></section>
  </main>;
}
export function SignOutButton() {
  return <button onClick={() => void signOut({ redirectTo: "/login" })}>Sign out</button>;
}
