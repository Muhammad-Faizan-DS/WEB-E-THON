import { cn } from "@/lib/utils";

/**
 * Progress drawn as an exam answer strip: one cell per question instead of a generic bar.
 * Filled = answered and accepted by the server, amber stripes = kept on the device (waiting to sync),
 * outlined = the question on screen, empty = not answered yet. Long papers group questions per cell.
 */
export function AnswerStrip({
  total,
  answered,
  kept = 0,
  current,
  state = "live",
  tone = "light",
  label,
  className,
}: {
  total: number;
  answered: number;
  /** answers saved on the device but not yet acknowledged by the server (shown after the answered ones) */
  kept?: number;
  /** 0-based index of the question on screen, if known */
  current?: number;
  state?: "live" | "done" | "locked";
  tone?: "light" | "dark";
  label: string;
  className?: string;
}) {
  const MAX = 30;
  const per = total > MAX ? total / MAX : 1;
  const cells = Math.max(1, Math.min(total, MAX));
  const filledCells = Math.round(answered / per);
  const keptCells = Math.round(kept / per);
  const currentCell = current !== undefined ? Math.floor(current / per) : -1;

  const dark = tone === "dark";
  const look = {
    answered: dark
      ? "bg-emerald shadow-[inset_0_1px_0_rgb(255_255_255/0.35)]"
      : "bg-primary shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]",
    locked: dark ? "bg-white/35" : "bg-muted-foreground/45",
    kept: "bg-[repeating-linear-gradient(135deg,#f59e0b_0_2px,rgb(245_158_11/0.35)_2px_4px)]",
    current: dark ? "bg-white/[0.06] ring-[1.5px] ring-inset ring-white/70" : "bg-surface ring-[1.5px] ring-inset ring-foreground/55",
    empty: dark ? "bg-white/[0.07] ring-1 ring-inset ring-white/[0.06]" : "bg-surface-2 ring-1 ring-inset ring-border",
  };

  return (
    <div role="img" aria-label={label} className={cn("flex h-2.5 w-full gap-[3px]", className)}>
      {Array.from({ length: cells }, (_, i) => {
        const kind =
          i < filledCells ? (state === "locked" ? "locked" : "answered")
          : i < filledCells + keptCells ? "kept"
          : i === currentCell && state === "live" ? "current"
          : "empty";
        return (
          <span
            key={i}
            className={cn("min-w-[3px] flex-1 rounded-[3px] transition-colors duration-300 ease-out", look[kind])}
          />
        );
      })}
    </div>
  );
}
