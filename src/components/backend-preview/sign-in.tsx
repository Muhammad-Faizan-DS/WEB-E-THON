"use client";

import { signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

const demoAccounts = [
  ["Administrator", "admin@example.test"],
  ["Examiner", "examiner@example.test"],
  ["Candidate", "candidate@example.test"],
] as const;

export function SignInPanel({ showDemoAccounts = false }: { showDemoAccounts?: boolean }) {
  const router = useRouter();
  const email = useRef<HTMLInputElement>(null);
  const password = useRef<HTMLInputElement>(null);
  const [state, setState] = useState({ busy: false, message: "" });
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setState({ busy: true, message: "" });
    try {
      const result = await signIn("credentials", { email: data.get("email"), password: data.get("password"), redirect: false });
      if (!result?.ok || result.error) {
        setState({ busy: false, message: "Sign-in failed. Check your email and password." });
        return;
      }
      // "/" resolves the signed-in role on the server and redirects to /admin, /examiner or /candidate.
      router.replace("/");
      router.refresh();
    } catch {
      setState({ busy: false, message: "Could not reach SecureExam. Try again." });
    }
  }
  function fillDemo(address: string) {
    if (email.current) email.current.value = address;
    password.current?.focus();
  }
  return <main className="sign-in">
    <section className="sign-in-brand">
      <div className="brand"><span aria-hidden="true">SE</span>SecureExam</div>
      <div><h1>Secure examination management</h1>
        <p>Create exams, take assessments, and review published results from one workspace.</p></div>
    </section>
    <section className="sign-in-form"><form onSubmit={submit}>
      <h2>Sign in</h2><p>Use the account assigned to you.</p>
      <label>Email<input ref={email} required name="email" type="email" autoComplete="username" /></label>
      <label>Password<input ref={password} required name="password" type="password" autoComplete="current-password" /></label>
      {state.message && <p role="alert" className="error">{state.message}</p>}
      <button disabled={state.busy} className="primary">{state.busy ? "Signing in…" : "Sign in"}</button>
      {showDemoAccounts && <fieldset className="demo-accounts">
        <legend>Development accounts</legend>
        <div className="actions">{demoAccounts.map(([label, address]) =>
          <button key={address} type="button" onClick={() => fillDemo(address)}>{label}</button>)}</div>
        <small>Fills the email. The password is <code>SEED_PASSWORD</code> from <code>.env.local</code>.</small>
      </fieldset>}
    </form></section>
  </main>;
}
export function SignOutButton() {
  return <button onClick={() => void signOut({ redirectTo: "/login" })}>Sign out</button>;
}
