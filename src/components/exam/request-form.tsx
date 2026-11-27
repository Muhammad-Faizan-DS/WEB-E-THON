"use client";
import * as React from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { RequestCreate } from "@/contracts";
import { api, ApiError } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/input";

const CATEGORIES = [
  { v: "connectivity", l: "Internet problem" },
  { v: "device", l: "Device problem" },
  { v: "power", l: "Power cut" },
  { v: "other", l: "Something else" },
] as const;

/** Unlock / re-attempt request (BR-13). The examiner sees the reason next to the connection timeline. */
export function RequestForm({ attemptId, type, onSent }: { attemptId: string; type: "unlock" | "reattempt"; onSent: () => void }) {
  const [category, setCategory] = React.useState<(typeof CATEGORIES)[number]["v"]>("connectivity");
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = RequestCreate.safeParse({ type, reasonCategory: category, reason });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setPending(true);
    try {
      await api.post(`/api/attempts/${attemptId}/requests`, parsed.data);
      toast.success("Request sent to your examiner");
      onSent();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send the request.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <fieldset>
        <legend className="text-sm font-medium">What happened?</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {CATEGORIES.map((c) => (
            <label key={c.v} className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
              <input type="radio" name="category" value={c.v} checked={category === c.v} onChange={() => setCategory(c.v)} className="accent-[var(--primary)]" />
              {c.l}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="space-y-1.5">
        <Label htmlFor={`reason-${type}`}>Explain briefly</Label>
        <Textarea id={`reason-${type}`} value={reason} onChange={(e) => { setReason(e.target.value); setError(null); }} maxLength={500}
          placeholder="For example: my laptop battery died at 10:40 and I switched to my sister's laptop." aria-invalid={!!error} aria-describedby={`reason-help-${type}`} />
        <p id={`reason-help-${type}`} className={error ? "text-sm text-danger" : "text-xs text-muted-foreground"}>
          {error ?? `${reason.trim().length}/500 · Your examiner decides. ${type === "unlock" ? "The exam timer keeps running while locked." : "Your current attempt stays on record."}`}
        </p>
      </div>
      <Button type="submit" disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <Send />} Send request</Button>
    </form>
  );
}
