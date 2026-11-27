"use client";
import * as React from "react";
import { Clock3, Loader2, Square } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/client/api";
import { CloseCreate, ExtendCreate } from "@/lib/client/proctor";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** All-candidate actions on the live monitor: add time for everyone, or close the exam now. Both are audited. */
export function ExamActions({ examId, live, inProgress, onDone }: { examId: string; live: boolean; inProgress: number; onDone: () => void }) {
  const [dialog, setDialog] = React.useState<"extend" | "close" | null>(null);
  if (!live) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => setDialog("extend")}><Clock3 /> Add time for everyone</Button>
      <Button variant="outline" size="sm" className="text-danger hover:text-danger" onClick={() => setDialog("close")}><Square /> Close exam now</Button>
      <ExtendAllDialog examId={examId} inProgress={inProgress} open={dialog === "extend"} onOpenChange={(o) => setDialog(o ? "extend" : null)} onDone={onDone} />
      <CloseDialog examId={examId} inProgress={inProgress} open={dialog === "close"} onOpenChange={(o) => setDialog(o ? "close" : null)} onDone={onDone} />
    </div>
  );
}

function ExtendAllDialog({ examId, inProgress, open, onOpenChange, onDone }: { examId: string; inProgress: number; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const [minutes, setMinutes] = React.useState(10);
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = ExtendCreate.safeParse({ minutes, reason });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setPending(true);
    try {
      const r = await api.post<{ affected: number }>(`/api/exams/${examId}/extend`, parsed.data);
      toast.success(`Added ${minutes} min for ${r.affected} candidate${r.affected === 1 ? "" : "s"}`, { description: "An announcement was sent and the change was recorded." });
      setReason(""); setError(null); onOpenChange(false); onDone();
    } catch (err) { setError(err instanceof ApiError ? err.message : "Couldn't add time."); } finally { setPending(false); }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Add time for everyone</DialogTitle>
            <DialogDescription>Moves the deadline of all {inProgress} candidate{inProgress === 1 ? "" : "s"} still working. Use it for disruptions that affected the whole room. Everyone gets an announcement.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-[7rem_1fr]">
            <div><Label htmlFor="all-min">Minutes</Label><Input id="all-min" type="number" min={1} max={60} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} /></div>
            <div><Label htmlFor="all-why">Reason (kept on record)</Label><Input id="all-why" value={reason} onChange={(e) => { setReason(e.target.value); setError(null); }} placeholder="e.g. Lab power cut, 8 minutes" aria-invalid={!!error} aria-describedby="all-err" /></div>
          </div>
          <p id="all-err" className={cn("text-sm", error ? "text-danger" : "text-muted-foreground")} aria-live="polite">{error ?? "Recorded with your name and time."}</p>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <Clock3 />} Add {minutes || 0} min</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CloseDialog({ examId, inProgress, open, onOpenChange, onDone }: { examId: string; inProgress: number; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = CloseCreate.safeParse({ reason });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setPending(true);
    try {
      const r = await api.post<{ finalized: number }>(`/api/exams/${examId}/close`, parsed.data);
      toast.success("Exam closed", { description: `${r.finalized} attempt${r.finalized === 1 ? "" : "s"} submitted from accepted answers.` });
      setReason(""); setError(null); onOpenChange(false); onDone();
    } catch (err) { setError(err instanceof ApiError ? err.message : "Couldn't close the exam."); } finally { setPending(false); }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Close this exam now?</DialogTitle>
            <DialogDescription>
              The window closes immediately. {inProgress} attempt{inProgress === 1 ? " is" : "s are"} still open and will be submitted from the answers the server has already accepted. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <div><Label htmlFor="close-why">Reason (kept on record)</Label><Input id="close-why" value={reason} onChange={(e) => { setReason(e.target.value); setError(null); }} placeholder="e.g. Paper leaked; exam will be rescheduled" aria-invalid={!!error} aria-describedby="close-err" /></div>
          <p id="close-err" className={cn("text-sm", error ? "text-danger" : "text-muted-foreground")} aria-live="polite">{error ?? "Candidates see an announcement with your reason."}</p>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Keep it open</Button>
            <Button type="submit" variant="danger" disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <Square />} Close exam</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
