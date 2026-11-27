"use client";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, LogIn } from "lucide-react";
import { LoginRequest, Me } from "@/contracts";
import { api, ApiError, USE_MOCKS } from "@/lib/client/api";
import { ROLE_HOME } from "@/lib/client/me";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

const DEMO = [
  { label: "Candidate", email: "ali@exam.test" },
  { label: "Candidate 2", email: "sara@exam.test" },
  { label: "Examiner", email: "examiner@exam.test" },
  { label: "Admin", email: "admin@exam.test" },
];
const SHOW_DEMO = USE_MOCKS || process.env.NEXT_PUBLIC_DEMO_HINTS === "1";
/** Homepage "Try it as" links: /login?as=candidate|examiner|admin pre-fills that demo account. */
const AS_PRESET: Record<string, string> = { candidate: "ali@exam.test", examiner: "examiner@exam.test", admin: "admin@exam.test" };

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const preset = SHOW_DEMO ? AS_PRESET[params.get("as") ?? ""] : undefined;
  const [email, setEmail] = React.useState(preset ?? "");
  const [password, setPassword] = React.useState(preset ? "Demo@2026" : "");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = LoginRequest.safeParse({ email, password });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    setPending(true);
    try {
      const me = await api.post("/api/auth/login", parsed.data, Me);
      const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : ROLE_HOME[me.role];
      router.replace(dest);
    } catch (err) {
      setFormError(err instanceof ApiError ? (err.isNetwork ? "Can't reach the server. Check your connection and try again." : err.message) : "Something went wrong.");
      setPending(false);
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
        {formError && <Alert tone="danger">{formError}</Alert>}
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-err" : undefined} />
          {errors.email && <p id="email-err" className="text-sm text-danger">{errors.email}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!errors.password} aria-describedby={errors.password ? "pw-err" : undefined} />
          {errors.password && <p id="pw-err" className="text-sm text-danger">{errors.password}</p>}
        </div>
        <Button type="submit" className="mt-2 w-full" size="lg" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <LogIn />} Sign in
        </Button>
      </form>
      {SHOW_DEMO && (
        <section aria-labelledby="demo-title" className="mt-10 border-t pt-6">
          <h3 id="demo-title" className="text-[13px] font-semibold">Demo accounts</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Fictional data. Password for all: <span className="font-mono">Demo@2026</span></p>
          <ul className="mt-3 divide-y rounded-lg border bg-surface">
            {DEMO.map((d) => (
              <li key={d.email}>
                <button type="button" onClick={() => { setEmail(d.email); setPassword("Demo@2026"); }}
                  className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-surface-2"
                  aria-label={`Use ${d.label} account`}>
                  <span className="font-medium">{d.label}</span>
                  <span className="font-mono text-xs text-muted-foreground">{d.email}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
