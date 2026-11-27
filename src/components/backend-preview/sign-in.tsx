"use client";

import { signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function SignInPanel() {
  const router = useRouter();
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
      router.replace("/");
      router.refresh();
      setState({ busy: false, message: "" });
    } catch {
      setState({ busy: false, message: "Could not reach SecureExam. Try again." });
    }
  }
  return <main className="sign-in">
    <section className="sign-in-brand">
      <div className="brand"><span aria-hidden="true">SE</span>SecureExam</div>
      <div><h1>Secure examination management</h1>
        <p>Create exams, take assessments, and review published results from one workspace.</p></div>
    </section>
    <section className="sign-in-form"><form onSubmit={submit}>
      <h2>Sign in</h2><p>Use the account assigned to you.</p>
      <label>Email<input required name="email" type="email" autoComplete="username" /></label>
      <label>Password<input required name="password" type="password" autoComplete="current-password" /></label>
      {state.message && <p role="alert" className="error">{state.message}</p>}
      <button disabled={state.busy} className="primary">{state.busy ? "Signing in…" : "Sign in"}</button>
    </form></section>
  </main>;
}
export function SignOutButton() {
  return <button onClick={() => void signOut({ redirectTo: "/" })}>Sign out</button>;
}
