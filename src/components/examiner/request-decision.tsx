"use client";
import * as React from "react";
import { Check, Loader2, Lock, RotateCcw, Wifi, X } from "lucide-react";
import { toast } from "sonner";
import { DecisionRequest, type ExamRequest } from "@/contracts";
import { api, ApiError } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { fmtDuration, fmtTime } from "@/lib/utils";

const CATEGORY_LABEL = { connectivity: "Internet problem", device: "Device problem", power: "Power cut", other: "Something else" };

export function RequestTypeBadge({ type }: { type: ExamRequest["type"] }) {
  return type === "unlock"
    ? <Badge tone="warning"><Lock aria-hidden />Unlock</Badge>
    : <Badge tone="flag"><RotateCcw aria-hidden />Re-attempt</Badge>;
}

/** Strict decision (BR-13): note required, context shown, everything audited server-side. */
export function RequestDecisionDialog({ request, open, onOpenChange, onDecided }: { request: ExamRequest | null; open: boolean; onOpenChange: (o: boolean) => void; onDecided: () => void }) {
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<"approve" | "deny" | null>(null);

  async function decide(decision: "approve" | "deny") {
    if (!request) return;
    const parsed = DecisionRequest.safeParse({ decision, note });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setPending(decision);
    try {
      await api.post(`/api/requests/${request.id}/decision`, parsed.data);
      toast.success(decision === "approve" ? (request.type === "unlock" ? "Attempt unlocked" : "Re-attempt approved") : "Request declined");
      setNote(""); setError(null);
      onOpenChange(false);
      onDecided();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save the decision.");
    } finally {
      setPending(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!pending) { onOpenChange(o); if (!o) { setError(null); } } }}>
      <DialogContent className="max-w-xl">
        {request && (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">{request.candidateName} <RequestTypeBadge type={request.type} /></DialogTitle>
              <DialogDescription>
                Sent {fmtTime(request.createdAt, false)} · {CATEGORY_LABEL[request.reasonCategory]}
              </DialogDescription>
            </DialogHeader>
            <blockquote className="rounded-lg border-l-4 border-primary bg-surface-2 p-3 text-sm leading-relaxed">“{request.reason}”</blockquote>
            <dl className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-md border p-2"><dt className="text-xs text-muted-foreground">Attempt</dt><dd className="font-medium capitalize">{request.attemptStatus.replace("_", " ")}</dd></div>
              <div className="rounded-md border p-2"><dt className="text-xs text-muted-foreground">Opens used</dt><dd className="font-medium tabular-nums">{request.opensUsed}</dd></div>
              <div className="rounded-md border p-2"><dt className="flex items-center justify-center gap-1 text-xs text-muted-foreground"><Wifi className="size-3" aria-hidden />Offline</dt><dd className="font-medium tabular-nums">{request.connectivityIncidents ? `${request.connectivityIncidents}× · ${fmtDuration(request.offlineSeconds)}` : "None seen"}</dd></div>
            </dl>
            <p className="text-sm text-muted-foreground">
              {request.type === "unlock"
                ? "Unlocking lets them continue with their saved answers. The deadline does not change, so no extra time is given."
                : "Approving voids the current attempt (it stays on record) and allows one new attempt with a fresh paper, inside the exam window."}
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="decision-note">Note for the record (shown to the candidate)</Label>
              <Textarea id="decision-note" value={note} onChange={(e) => { setNote(e.target.value); setError(null); }} maxLength={500}
                placeholder="e.g. Device restart confirmed by the timeline; unlocking." aria-invalid={!!error} aria-describedby="decision-err" />
              {error && <p id="decision-err" className="text-sm text-danger">{error}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => decide("deny")} disabled={!!pending}>{pending === "deny" ? <Loader2 className="animate-spin" /> : <X />} Decline</Button>
              <Button onClick={() => decide("approve")} disabled={!!pending}>{pending === "approve" ? <Loader2 className="animate-spin" /> : <Check />} {request.type === "unlock" ? "Approve & unlock" : "Approve re-attempt"}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
