"use client";
import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, CloudOff, HardDrive, Loader2 } from "lucide-react";
import { cn, fmtTime } from "@/lib/utils";

type Status = "idle" | "saving" | "saved" | "device" | "syncing";
interface Row { rev: number; state: "accepted" | "device"; at: number }

const START = "A model that always predicts the majority class can still score high accuracy";

/**
 * Answers save as numbered revisions. "Saved" shows only when the server's receipt matches the latest
 * revision; offline edits are kept on the device (the carbon copy) and synced on reconnect.
 */
export function ReceiptDemo() {
  const reduce = useReducedMotion();
  const [text, setText] = React.useState(START);
  const [online, setOnline] = React.useState(true);
  const [status, setStatus] = React.useState<Status>("idle");
  const [rev, setRev] = React.useState(6);
  const revRef = React.useRef(6);
  const [rows, setRows] = React.useState<Row[]>([]);
  const timer = React.useRef(0);
  const onlineRef = React.useRef(online);
  React.useEffect(() => {
    onlineRef.current = online;
  }, [online]);
  React.useEffect(() => () => window.clearTimeout(timer.current), []);

  const pending = rows.filter((r) => r.state === "device").length;
  const latest = rows[0];

  function commit(nextRev: number) {
    if (onlineRef.current) {
      setStatus("saving");
      timer.current = window.setTimeout(() => {
        setRows((rs) => [{ rev: nextRev, state: "accepted" as const, at: Date.now() }, ...rs].slice(0, 5));
        setStatus("saved");
      }, 650);
    } else {
      setRows((rs) => [{ rev: nextRev, state: "device" as const, at: Date.now() }, ...rs].slice(0, 5));
      setStatus("device");
    }
  }

  function onChange(v: string) {
    setText(v);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const next = ++revRef.current;
      setRev(next);
      commit(next);
    }, 500);
  }

  function toggle() {
    const next = !online;
    setOnline(next);
    onlineRef.current = next;
    if (next && pending > 0) {
      setStatus("syncing");
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        const now = Date.now();
        setRows((rs) => rs.map((r) => (r.state === "device" ? { ...r, state: "accepted" as const, at: now } : r)));
        setStatus("saved");
      }, 900);
    }
  }

  const label: Record<Status, React.ReactNode> = {
    idle: <>Type in the answer, then switch the connection off and on.</>,
    saving: <>Saving revision {rev}…</>,
    saved: <>Saved {latest ? fmtTime(latest.at) : ""} · revision {latest?.rev} accepted by the server</>,
    device: <>Saved on this device · revision {latest?.rev}, waiting for the connection</>,
    syncing: <>Back online · sending {pending} kept {pending === 1 ? "revision" : "revisions"}…</>,
  };
  const icon: Record<Status, React.ReactNode> = {
    idle: null,
    saving: <Loader2 className="size-4 animate-spin" aria-hidden />,
    saved: <Check className="size-4 text-[#1e7a4c]" aria-hidden />,
    device: <HardDrive className="size-4 text-warning" aria-hidden />,
    syncing: <Loader2 className="size-4 animate-spin" aria-hidden />,
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 text-[14px] font-medium">
          <span aria-hidden className={cn("size-2.5 rounded-full", online ? "bg-[#1e7a4c]" : "bg-danger")} />
          {online ? "Online" : "Offline"}
          {!online && <CloudOff className="size-4 text-muted-foreground" aria-hidden />}
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={!online}
          onClick={toggle}
          className="group inline-flex min-h-11 items-center gap-3 rounded-[6px] px-1 text-[14px] font-medium"
        >
          Simulate a dropped connection
          <span className={cn("relative h-6 w-11 rounded-full border border-border-strong transition-colors duration-200", online ? "bg-surface" : "bg-foreground")}>
            <span className={cn("absolute top-[3px] size-4 rounded-full transition-[left,background-color] duration-200 ease-out", online ? "left-[3px] bg-foreground" : "left-[23px] bg-amber-200")} />
          </span>
        </button>
      </div>

      <div className="relative mt-4">
        {/* the carbon copy kept on the device */}
        <AnimatePresence>
          {pending > 0 && (
            <motion.div
              aria-hidden
              className="absolute inset-0 rounded-2xl bg-amber-200 shadow-[0_8px_20px_-8px_rgb(0_0_0/0.35)]"
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: 0, y: 0, rotate: 0 }}
              animate={reduce ? { opacity: 1, y: 30 } : { opacity: 1, x: 8, y: 30, rotate: 0.8 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: 0, y: 0, rotate: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="absolute bottom-[7px] left-5 font-display text-[11px] font-bold tracking-[0.06em] text-amber-900 uppercase">Copy kept on this device</span>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="relative rounded-2xl border border-border bg-surface p-5 shadow-[0_1px_2px_rgb(11_15_13/0.04),0_24px_48px_-24px_rgb(11_15_13/0.18)] sm:p-6">
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor="demo-answer" className="font-display text-[15px] font-bold">
              Question 3 <span className="font-sans text-[13px] font-normal text-muted-foreground">· written · 5 marks</span>
            </label>
            <span className="font-mono text-[12px] text-muted-foreground tabular-nums">rev {rev}</span>
          </div>
          <p className="mt-2 text-[15px] leading-[1.55]">Why can accuracy be misleading on an imbalanced dataset?</p>
          <textarea
            id="demo-answer"
            value={text}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            className="mt-3 block w-full resize-none rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-[15px] leading-[1.55] text-foreground outline-none transition-[border-color,box-shadow] duration-150 focus:border-primary focus:shadow-[0_0_0_3px_rgb(4_120_87/0.18)]"
          />
          <p aria-live="polite" className="mt-3 flex min-h-[1.6em] items-center gap-2 text-[14px] font-medium">
            {icon[status]}
            <span>{label[status]}</span>
          </p>
        </div>
      </div>

      <ol aria-label="Receipts" className="mt-14 divide-y divide-border border-y border-border">
        {rows.length === 0 && <li className="py-3 text-[14px] text-muted-foreground">No revisions saved yet in this demo.</li>}
        {rows.map((r, i) => (
          <li key={r.rev} className={cn("grid grid-cols-[4.5rem_1fr_auto] items-baseline gap-3 py-2.5 text-[14px]", i > 0 && "text-muted-foreground")}>
            <span className="font-mono text-[13px] tabular-nums">rev {r.rev}</span>
            <span>{r.state === "accepted" ? "Accepted by the server" : "Kept on this device"}</span>
            <span className="font-mono text-[12px] tabular-nums">{fmtTime(r.at)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
