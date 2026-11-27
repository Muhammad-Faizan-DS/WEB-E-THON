import type { Metadata } from "next";
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
      <section className="hidden flex-col justify-between border-r px-12 py-10 lg:flex">
        <Logo />
        <div className="max-w-lg">
          <h1 className="font-serif text-[40px] leading-[1.12] tracking-[-0.015em]">
            Exams candidates can trust, and evidence examiners can actually read.
          </h1>
          <dl className="mt-10 divide-y border-y">
            {PROMISES.map(([t, d]) => (
              <div key={t} className="grid grid-cols-[1fr_1.4fr] gap-6 py-4">
                <dt className="text-sm font-semibold">{t}</dt>
                <dd className="text-sm text-muted-foreground">{d}</dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="text-xs text-muted-foreground">Technoverse 5.0 · Web-e-Thon · COMSATS Lahore</p>
      </section>
      <section className="flex flex-col justify-center px-4 py-12 sm:px-10">
        <div className="mx-auto w-full max-w-[22rem]">
          <Logo className="mb-10 lg:hidden" />
          <h2 className="text-[26px] font-semibold tracking-[-0.01em]">Sign in</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">Use the account your institution gave you.</p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
