import { cn } from "@/lib/utils";

export interface FlowNode {
  /** a short drawn icon (lucide or inline svg), decorative */
  icon: React.ReactNode;
  label: string;
  sub?: string;
  /** "brand" = the outcome to remember, "no" = what does NOT happen (struck through) */
  tone?: "plain" | "brand" | "no";
}

/**
 * A one-line flow diagram that explains a mechanism before its demo: boxes joined by arrows, read left
 * to right (top to bottom on phones). The last box is the takeaway.
 */
export function Flow({ nodes, label, className }: { nodes: FlowNode[]; label: string; className?: string }) {
  return (
    <figure className={cn("mt-6", className)}>
      <figcaption className="sr-only">{label}</figcaption>
      <ol className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-0">
        {nodes.map((n, i) => (
          <li key={n.label} className="flex flex-col items-stretch sm:flex-1 sm:flex-row sm:items-center">
            <div
              className={cn(
                "flex min-w-0 flex-1 items-center gap-3 rounded-xl border px-3.5 py-3",
                n.tone === "brand" && "border-brand bg-brand text-brand-foreground",
                n.tone === "no" && "border-dashed border-border-strong bg-transparent text-muted-foreground",
                (!n.tone || n.tone === "plain") && "border-border bg-surface",
              )}
            >
              <span aria-hidden className={cn("grid size-9 shrink-0 place-items-center rounded-lg", n.tone === "brand" ? "bg-brand-foreground/10" : "bg-surface-2", "[&_svg]:size-[18px]")}>
                {n.icon}
              </span>
              <span className="min-w-0">
                <span className={cn("block text-[14px] leading-tight font-semibold", n.tone === "no" && "ink-strike")}>{n.label}</span>
                {n.sub && <span className={cn("mt-0.5 block text-[12px] leading-snug", n.tone === "brand" ? "text-brand-foreground" : "text-muted-foreground")}>{n.sub}</span>}
              </span>
            </div>
            {i < nodes.length - 1 && (
              <span aria-hidden className="flex shrink-0 items-center justify-center text-brand sm:w-8">
                <svg viewBox="0 0 24 24" className="size-5 rotate-90 sm:rotate-0" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12h15M13 6l6 6-6 6" />
                </svg>
              </span>
            )}
          </li>
        ))}
      </ol>
    </figure>
  );
}
