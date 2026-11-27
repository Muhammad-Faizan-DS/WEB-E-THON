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
      <section className="relative hidden flex-col justify-between border-r border-border bg-surface-2 px-12 py-10 lg:flex">
        <Link href="/" className="w-fit rounded-md" aria-label="Fairmark home">
          <Logo className="text-[17px]" />
        </Link>
        <div className="max-w-lg">
          <h1 className="display text-[34px] leading-[1.12]">
            Exams candidates can trust, and evidence examiners can actually read.
          </h1>
          <ul className="mt-10 divide-y divide-border border-y border-border">
            {PROMISES.map(([t, d]) => (
              <li key={t} className="grid grid-cols-[1.25rem_1fr] gap-3 py-4">
                <svg viewBox="0 0 20 20" aria-hidden className="mt-0.5 size-4 text-primary">
                  <path d="m4.5 10.5 3.4 3.4 7.6-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div>
                  <p className="text-sm font-medium">{t}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{d}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">Technoverse 5.0 · Web-e-Thon · COMSATS Lahore</p>
      </section>
      <section className="relative flex flex-col justify-center px-4 py-12 sm:px-10">
        <ThemeToggle className="absolute top-4 right-4" />
        <div className="mx-auto w-full max-w-[22rem]">
          <Logo className="mb-10 lg:hidden" />
          <h2 className="text-[28px] font-semibold tracking-[-0.025em]">Sign in</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">Use the account your institution gave you.</p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
