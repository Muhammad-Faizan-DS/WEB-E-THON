import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { Logo } from "@/components/common/brand";
import { ThemeToggle } from "@/components/common/theme-toggle";

export const metadata: Metadata = { title: "Sign in" };

const PROMISES = [
  ["Time is kept by the server.", "Refreshing, reconnecting or changing your clock never moves your deadline."],
  ["Every answer is accounted for.", "During an outage your work stays on your device and syncs when you're back."],
  ["Observations are explained, not judged.", "A person reviews them. Nothing changes marks automatically."],
];

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <section className="mesh-plate relative hidden flex-col justify-between overflow-hidden px-12 py-10 lg:flex">
        <Link href="/" className="relative z-10 w-fit rounded-md" aria-label="Fairmark home">
          <Logo className="text-[17px]" />
        </Link>
        <div className="relative z-10 max-w-lg rounded-2xl border border-white/50 bg-surface/70 p-8 backdrop-blur-xl dark:border-white/10 dark:bg-surface/60">
          <h1 className="display text-[38px] leading-[1.08]">
            Exams candidates can trust, and evidence examiners can actually read.
          </h1>
          <dl className="mt-8 divide-y divide-border border-y border-border">
            {PROMISES.map(([t, d]) => (
              <div key={t} className="grid grid-cols-[1fr_1.4fr] gap-6 py-4">
                <dt className="text-sm font-semibold">{t}</dt>
                <dd className="text-sm text-muted-foreground">{d}</dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="relative z-10 w-fit rounded-md bg-surface/70 px-2 py-1 text-xs text-foreground backdrop-blur-sm">Technoverse 5.0 · Web-e-Thon · COMSATS Lahore</p>
      </section>
      <section className="relative flex flex-col justify-center px-4 py-12 sm:px-10">
        <ThemeToggle className="absolute top-4 right-4" />
        <div className="mx-auto w-full max-w-[22rem]">
          <Logo className="mb-10 lg:hidden" />
          <h2 className="text-[28px] font-bold tracking-[-0.025em]">Sign in</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">Use the account your institution gave you.</p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
