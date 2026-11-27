import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { Logo } from "@/components/common/brand";

export const metadata: Metadata = { title: "Sign in" };

const PROMISES = [
  ["Time is kept by the server.", "Refreshing, reconnecting or changing your clock never moves your deadline."],
  ["Every answer is accounted for.", "During an outage your work stays on your device and syncs when you're back."],
  ["Observations are explained, not judged.", "A person reviews them. Nothing changes marks automatically."],
];

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <section className="on-night relative hidden flex-col justify-between overflow-hidden bg-night px-12 py-10 text-on-night lg:flex">
        <div aria-hidden className="absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(60%_70%_at_30%_0%,rgb(16_185_129/0.25),transparent_70%)]" />
        <Link href="/" className="relative w-fit rounded-md" aria-label="Fairmark home">
          <Logo className="text-on-night [&_svg]:text-emerald" />
        </Link>
        <div className="relative max-w-lg">
          <h1 className="display text-[44px] leading-[1.05] font-extrabold">
            Exams candidates can trust, and evidence examiners can actually read.
          </h1>
          <dl className="mt-10 divide-y divide-night-line border-y border-night-line">
            {PROMISES.map(([t, d]) => (
              <div key={t} className="grid grid-cols-[1fr_1.4fr] gap-6 py-4">
                <dt className="text-sm font-semibold">{t}</dt>
                <dd className="text-sm text-on-night-muted">{d}</dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="relative text-xs text-on-night-muted">Technoverse 5.0 · Web-e-Thon · COMSATS Lahore</p>
      </section>
      <section className="flex flex-col justify-center px-4 py-12 sm:px-10">
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
