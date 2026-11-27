import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { Logo } from "@/components/common/brand";
import { CloudCheck, Clock3, ScanEye } from "lucide-react";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden border-r bg-primary p-10 text-primary-foreground lg:flex">
        <Logo className="text-lg text-primary-foreground [&_svg]:text-primary-foreground" />
        <div className="max-w-md space-y-8">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Exams candidates can trust, and evidence examiners can read.
          </h1>
          <ul className="space-y-5 text-primary-foreground/90">
            <li className="flex gap-3"><Clock3 className="mt-0.5 size-5 shrink-0" aria-hidden /><span><b className="font-semibold">Server-kept time.</b> Refreshing or changing your clock never changes your deadline.</span></li>
            <li className="flex gap-3"><CloudCheck className="mt-0.5 size-5 shrink-0" aria-hidden /><span><b className="font-semibold">Every answer accounted for.</b> Work stays on your device during outages and syncs when you&apos;re back.</span></li>
            <li className="flex gap-3"><ScanEye className="mt-0.5 size-5 shrink-0" aria-hidden /><span><b className="font-semibold">Explained, not accused.</b> Observations are grouped and reviewed by a person, never auto-penalised.</span></li>
          </ul>
        </div>
        <p className="text-sm text-primary-foreground/70">Technoverse 5.0 · Web-e-Thon</p>
        <svg className="pointer-events-none absolute -right-24 -bottom-24 size-[28rem] text-primary-foreground/10" viewBox="0 0 200 200" aria-hidden>
          {Array.from({ length: 9 }, (_, i) => <circle key={i} cx="100" cy="100" r={20 + i * 10} fill="none" stroke="currentColor" strokeWidth="1" />)}
        </svg>
      </section>
      <section className="flex flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <Logo className="mb-8 text-lg lg:hidden" />
          <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-1 text-sm text-muted-foreground">Use the account your institution gave you.</p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
