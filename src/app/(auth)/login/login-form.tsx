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

export function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
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
      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
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
        <Button type="submit" className="w-full" size="lg" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <LogIn />} Sign in
        </Button>
      </form>
      {SHOW_DEMO && (
        <div className="mt-8 rounded-lg border border-dashed p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Demo accounts · password Demo@2026</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {DEMO.map((d) => (
              <Button key={d.email} type="button" variant="outline" size="sm" onClick={() => { setEmail(d.email); setPassword("Demo@2026"); }}>
                {d.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
