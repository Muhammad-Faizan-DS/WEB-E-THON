"use client";
import * as React from "react";
import { toast } from "sonner";
import type { AnswerValue, CandidateQuestion } from "@/contracts";
import type { LocalAnswer } from "@/lib/client/exam-engine";
import { Checkbox, RadioGroup, RadioGroupItem } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TYPE_LABEL = { single: "Choose one", multi: "Choose all that apply", written: "Written answer" } as const;

interface Props {
  q: CandidateQuestion;
  total: number;
  answer: LocalAnswer | undefined;
  onChange: (v: AnswerValue | null, debounceMs?: number) => void;
  pastePolicy: "allow" | "block" | "log";
  split: boolean;
  disabled: boolean;
  onPaste: (chars: number, outcome: "allowed" | "blocked") => void;
  onCopyBlocked: () => void;
}

export function QuestionView({ q, total, answer, onChange, pastePolicy, split, disabled, onPaste, onCopyBlocked }: Props) {
  const header = (
    <header className="flex flex-wrap items-center gap-2 text-sm">
      <h2 className="font-semibold">Question {q.position} <span className="font-normal text-muted-foreground">of {total}</span></h2>
      <Badge tone="neutral">{TYPE_LABEL[q.type]}</Badge>
      <Badge tone="primary">{q.marks} {q.marks === 1 ? "mark" : "marks"}</Badge>
      {q.type === "multi" && <span className="text-xs text-muted-foreground">{q.multiRule === "partial" ? "Partial marks: wrong choices subtract" : "Exact match: all correct choices, no wrong ones"}</span>}
    </header>
  );
  const prompt = (
    <div
      className="q-text select-text whitespace-pre-line"
      onCopy={(e) => { if (pastePolicy === "block") { e.preventDefault(); onCopyBlocked(); toast.message("Copying questions is turned off for this exam"); } }}
    >
      {q.prompt}
    </div>
  );

  const body =
    q.type === "written" ? (
      <WrittenAnswer q={q} answer={answer} onChange={onChange} pastePolicy={pastePolicy} disabled={disabled} onPaste={onPaste} />
    ) : (
      <ChoiceAnswer q={q} answer={answer} onChange={onChange} disabled={disabled} />
    );

  if (split && q.type === "written") {
    return (
      <article className="grid gap-6 lg:grid-cols-2" aria-labelledby={`q-${q.aqId}`}>
        <div className="space-y-4" id={`q-${q.aqId}`}>{header}{prompt}</div>
        <div>{body}</div>
      </article>
    );
  }
  return (
    <article className="space-y-5" aria-labelledby={`q-${q.aqId}`}>
      <div className="space-y-4" id={`q-${q.aqId}`}>{header}{prompt}</div>
      {body}
    </article>
  );
}

function ChoiceAnswer({ q, answer, onChange, disabled }: Pick<Props, "q" | "answer" | "onChange" | "disabled">) {
  const selected = answer?.value && "optionIds" in answer.value ? answer.value.optionIds : [];
  const letters = "ABCDEFGH";
  const opt = (o: { id: string; label: string }, i: number, control: React.ReactNode) => {
    const on = selected.includes(o.id);
    return (
      <label
        key={o.id}
        className={cn(
          "flex cursor-pointer items-center gap-3 rounded-lg border bg-surface px-4 py-3 transition-colors hover:bg-surface-2",
          on && "border-primary bg-primary-soft hover:bg-primary-soft",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        {control}
        <span className="grid size-6 shrink-0 place-items-center rounded border font-mono text-xs text-muted-foreground" aria-hidden>{letters[i]}</span>
        <span className="q-text">{o.label}</span>
      </label>
    );
  };

  if (q.type === "single") {
    return (
      <RadioGroup
        aria-label={`Options for question ${q.position}`}
        value={selected[0] ?? ""}
        onValueChange={(v) => onChange({ optionIds: [v] }, 150)}
        disabled={disabled}
        className="grid gap-2.5"
      >
        {q.options?.map((o, i) => opt(o, i, <RadioGroupItem value={o.id} aria-label={o.label} />))}
      </RadioGroup>
    );
  }
  return (
    <div role="group" aria-label={`Options for question ${q.position}`} className="grid gap-2.5">
      {q.options?.map((o, i) =>
        opt(o, i, (
          <Checkbox
            checked={selected.includes(o.id)}
            disabled={disabled}
            aria-label={o.label}
            onCheckedChange={(c) => {
              const next = c ? [...selected, o.id] : selected.filter((x) => x !== o.id);
              onChange(next.length ? { optionIds: next } : null, 150);
            }}
          />
        )),
      )}
      <p className="text-xs text-muted-foreground">{selected.length} selected</p>
    </div>
  );
}

function WrittenAnswer({ q, answer, onChange, pastePolicy, disabled, onPaste }: Pick<Props, "q" | "answer" | "onChange" | "pastePolicy" | "disabled" | "onPaste">) {
  const text = answer?.value && "text" in answer.value ? answer.value.text : "";
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return (
    <div className="space-y-2">
      <label htmlFor={`ans-${q.aqId}`} className="text-sm font-medium">Your answer</label>
      <textarea
        id={`ans-${q.aqId}`}
        value={text}
        disabled={disabled}
        spellCheck
        onChange={(e) => onChange(e.target.value ? { text: e.target.value } : null)}
        onPaste={(e) => {
          const chars = e.clipboardData.getData("text").length; // length only; content is never stored or sent
          if (pastePolicy === "block") {
            e.preventDefault();
            onPaste(chars, "blocked");
            toast.message("Pasting is turned off for this exam", { description: "Type your answer instead." });
          } else onPaste(chars, "allowed");
        }}
        onDrop={(e) => { if (pastePolicy === "block") e.preventDefault(); }}
        className="q-text min-h-64 w-full resize-y rounded-lg border border-input bg-surface p-4 leading-relaxed placeholder:text-muted-foreground disabled:opacity-60"
        placeholder="Type your answer here. It saves automatically."
        aria-describedby={`count-${q.aqId}`}
      />
      <p id={`count-${q.aqId}`} className="flex justify-between text-xs text-muted-foreground">
        <span>{words} {words === 1 ? "word" : "words"} · {text.length} characters</span>
        {pastePolicy === "block" && <span>Pasting is off</span>}
      </p>
    </div>
  );
}
