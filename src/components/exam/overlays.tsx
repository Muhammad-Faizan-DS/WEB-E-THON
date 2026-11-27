"use client";
import * as React from "react";
import { Lock, Maximize, MonitorSmartphone } from "lucide-react";
import type { PendingRequest } from "@/contracts";
import { Button } from "@/components/ui/button";
import { RequestForm } from "./request-form";

function Panel({ icon: Icon, title, children }: { icon: typeof Lock; title: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-[60dvh] place-items-center p-4">
      <div role="alertdialog" aria-labelledby="ov-title" className="w-full max-w-md rounded-xl border bg-surface p-6 shadow-lg">
        <Icon className="size-8 text-primary" aria-hidden />
        <h2 id="ov-title" className="mt-3 text-xl font-semibold">{title}</h2>
        <div className="mt-2 space-y-4 text-sm text-foreground/85">{children}</div>
      </div>
    </div>
  );
}

export function FullscreenGate({ onEnter }: { onEnter: () => void }) {
  return (
    <Panel icon={Maximize} title="Return to fullscreen">
      <p>This exam runs in fullscreen. The questions are hidden until you return. <b>Your answers are safe and the timer is still running.</b></p>
      <Button size="lg" className="w-full" onClick={onEnter} autoFocus><Maximize /> Enter fullscreen</Button>
      <p className="text-xs text-muted-foreground">Leaving fullscreen is noted for your examiner with its duration. It doesn&apos;t change your marks.</p>
    </Panel>
  );
}

export function SupersededPanel({ onTakeOver }: { onTakeOver: () => void }) {
  return (
    <Panel icon={MonitorSmartphone} title="This exam is open in another window">
      <p>To keep your answers consistent, only one window can save at a time. Close the other window, or continue here.</p>
      <Button className="w-full" onClick={onTakeOver} autoFocus>Use this window</Button>
    </Panel>
  );
}

export function LockedPanel({ attemptId, request, onSent }: { attemptId: string; request: PendingRequest; onSent: () => void }) {
  return (
    <Panel icon={Lock} title="Your attempt is locked">
      <p>This exam was opened in more tabs or devices than allowed. Your saved answers are safe, but <b>the timer keeps running</b> while it&apos;s locked.</p>
      {request?.type === "unlock" && request.status === "pending" ? (
        <p className="rounded-md bg-info-soft p-3 font-medium text-info">Request sent. Waiting for your examiner. This screen updates automatically.</p>
      ) : request?.type === "unlock" && request.status === "denied" ? (
        <p className="rounded-md bg-danger-soft p-3 text-danger">Your examiner declined the request{request.note ? `: “${request.note}”` : "."}</p>
      ) : (
        <RequestForm attemptId={attemptId} type="unlock" onSent={onSent} />
      )}
    </Panel>
  );
}
