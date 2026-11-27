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
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link href={nav[0]?.href ?? "/"} aria-label="Fairmark home"><Logo /></Link>
          <nav aria-label="Main" className="hidden gap-1 sm:flex">
            {nav.map((n) => {
              const active = path === n.href || (n.href !== nav[0].href && path.startsWith(n.href));
              return (
                <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined}
                  className={cn("rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-surface-2 hover:text-foreground", active && "bg-surface-2 font-medium text-foreground")}>
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right leading-tight sm:block">
              <p className="text-sm font-medium">{me.name}</p>
              <p className="text-xs capitalize text-muted-foreground">{me.role}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={logout}><LogOut /> <span className="hidden sm:inline">Sign out</span></Button>
          </div>
        </div>
        {nav.length > 1 && (
          <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-4 pb-2 sm:hidden">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className={cn("rounded-md px-3 py-1.5 text-sm whitespace-nowrap", path === n.href ? "bg-surface-2 font-medium" : "text-muted-foreground")}>{n.label}</Link>
            ))}
          </nav>
        )}
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 py-6 sm:py-8">{children}</main>
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
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  );
}
