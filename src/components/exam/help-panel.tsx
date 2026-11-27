"use client";
import * as React from "react";
import { Hand, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/client/api";
import { HELP_LABEL, HelpCreate, type HelpCategory, type ProctorMessage } from "@/lib/client/proctor";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/misc";
import { cn, fmtTime } from "@/lib/utils";

/**
 * "Ask for help" (the guide's raise hand, chat and break requests): the candidate writes to their
 * examiner without leaving the exam. The clock keeps running; only the examiner can add time.
 */
export function HelpButton({ attemptId, messages, unread, onOpen, onSent, disabled }: {
  attemptId: string; messages: ProctorMessage[]; unread: number; onOpen: () => void; onSent: () => void; disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [category, setCategory] = React.useState<HelpCategory>("question");
  const [body, setBody] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const openCount = messages.filter((m) => m.kind === "help" && !m.resolvedAt).length;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const parsed = HelpCreate.safeParse({ category, body });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setPending(true);
    try {
      await api.post(`/api/attempts/${attemptId}/help`, parsed.data);
      setBody(""); setError(null);
      toast.success("Sent to your examiner", { description: "Keep working. Their reply appears here and as a notice." });
      onSent();
    } catch (err) { setError(err instanceof ApiError ? (err.isNetwork ? "You're offline. Try again when you reconnect." : err.message) : "Couldn't send."); } finally { setPending(false); }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (o) onOpen(); }}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} className="relative" aria-label={unread ? `Ask for help, ${unread} new message${unread === 1 ? "" : "s"}` : "Ask for help"}>
          <Hand /> <span className="hidden md:inline">Ask for help</span>
          {unread > 0 && <span className="absolute -top-1.5 -right-1.5 grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground tabular-nums">{unread}</span>}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[min(26rem,100%)]">
        <SheetTitle className="pr-8 text-lg font-semibold">Ask your examiner</SheetTitle>
        <SheetDescription className="mt-1 text-sm text-muted-foreground">Your timer keeps running while you write. If something stopped you from working, your examiner can add time.</SheetDescription>

        {messages.length > 0 && (
          <ol className="mt-5 space-y-2" aria-label="Conversation with your examiner">
            {messages.map((m) => (
              <li key={m.id} className={cn("max-w-[90%] rounded-lg px-3 py-2 text-sm", m.from === "candidate" ? "ml-auto bg-primary-soft" : "bg-surface-2")}>
                <p className="text-[11px] text-muted-foreground">
                  {m.from === "candidate" ? (m.category ? HELP_LABEL[m.category] : "You") : m.kind === "reminder" ? "Reminder from your examiner" : "Your examiner"} · <span className="num">{fmtTime(m.createdAt, false)}</span>
                  {m.from === "candidate" && (m.resolvedAt ? " · answered" : " · waiting")}
                </p>
                <p className="mt-0.5">{m.body}</p>
              </li>
            ))}
          </ol>
        )}

        <form onSubmit={send} noValidate className="mt-6 space-y-4 border-t pt-5">
          <fieldset>
            <legend className="text-sm font-medium">What do you need?</legend>
            <RadioGroup value={category} onValueChange={(v) => setCategory(v as HelpCategory)} className="mt-2 grid gap-2">
              {(Object.keys(HELP_LABEL) as HelpCategory[]).map((k) => (
                <label key={k} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary-soft">
                  <RadioGroupItem value={k} aria-label={HELP_LABEL[k]} />{HELP_LABEL[k]}
                </label>
              ))}
            </RadioGroup>
          </fieldset>
          <div>
            <Label htmlFor="help-body">Message</Label>
            <Textarea id="help-body" rows={3} maxLength={500} value={body} onChange={(e) => { setBody(e.target.value); setError(null); }}
              placeholder="e.g. Question 2 mentions a table that I can't see." aria-invalid={!!error} aria-describedby="help-err" className="mt-1.5" />
            <p id="help-err" className={cn("mt-1.5 text-xs", error ? "text-danger" : "text-muted-foreground")} aria-live="polite">
              {error ?? (openCount ? `${openCount} request${openCount === 1 ? "" : "s"} waiting for a reply.` : "Only your examiner sees this. Don't include answers.")}
            </p>
          </div>
          <Button type="submit" className="w-full" disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <Send />} Send to examiner</Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
