"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { useMe } from "@/lib/client/me";
import { Logo } from "./brand";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export interface NavItem { href: string; label: string }

export function AppShell({ nav, children }: { nav: NavItem[]; children: React.ReactNode }) {
  const { me, logout } = useMe();
  const path = usePathname();
  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">Skip to content</a>
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <Link href={nav[0]?.href ?? "/"} aria-label="Fairmark home"><Logo /></Link>
          <nav aria-label="Main" className="hidden h-full items-stretch gap-5 sm:flex">
            {nav.map((n) => {
              const active = path === n.href || (n.href !== nav[0].href && path.startsWith(n.href));
              return (
                <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined}
                  className={cn("-mb-px inline-flex items-center border-b-2 border-transparent text-sm text-muted-foreground transition-colors hover:text-foreground", active && "border-foreground font-medium text-foreground")}>
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden text-right leading-tight sm:block">
              <p className="text-[13px] font-medium">{me.name}</p>
              <p className="text-xs capitalize text-muted-foreground">{me.role}</p>
            </div>
            <span className="grid size-8 place-items-center rounded-full bg-surface-2 text-xs font-semibold" aria-hidden>
              {me.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
            </span>
            <Button variant="ghost" size="sm" onClick={logout} aria-label="Sign out"><LogOut /></Button>
          </div>
        </div>
        {nav.length > 1 && (
          <nav aria-label="Main" className="flex gap-5 overflow-x-auto px-4 sm:hidden">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className={cn("-mb-px whitespace-nowrap border-b-2 border-transparent py-2 text-sm", path === n.href ? "border-foreground font-medium" : "text-muted-foreground")}>{n.label}</Link>
            ))}
          </nav>
        )}
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 py-8 sm:py-10">{children}</main>
    </div>
  );
}

export function ShellSkeleton() {
  return (
    <div className="min-h-dvh">
      <div className="h-14 border-b" />
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-8">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-44" />)}
        </div>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.01em]">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  );
}
