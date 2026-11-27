import { cn } from "@/lib/utils";

/**
 * Progress drawn as an exam answer strip: one cell per question instead of a generic bar.
 * Filled orange = answered and accepted by the server, brown stripes = kept on the device (waiting to sync),
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

  void tone; // both themes now share the brand look; kept for API compatibility
  const look = {
    answered: "bg-brand shadow-[inset_0_1px_0_rgb(255_255_255/0.35)]",
    locked: "bg-muted-foreground/45",
    kept: "bg-[repeating-linear-gradient(135deg,#796758_0_2px,rgb(121_103_88/0.3)_2px_4px)]",
    current: "bg-surface ring-[1.5px] ring-inset ring-foreground/60",
    empty: "bg-foreground/[0.07] ring-1 ring-inset ring-foreground/[0.06]",
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
