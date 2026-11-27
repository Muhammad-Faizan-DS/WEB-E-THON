import { FileText, FlaskConical, Gauge, NotebookPen, QrCode, Settings2, Upload, Wifi } from "lucide-react";

const FEATURES = [
  [Wifi, "Network-aware saving", "Online, offline or server unreachable, and exactly what is saved, always on screen."],
  [FileText, "PDF reports", "Candidate result and exam summary PDFs, generated from stored data and access-checked."],
  [FlaskConical, "Sandbox preview", "Take your own exam as a candidate. Sandbox attempts never count toward anything."],
  [Upload, "Bulk import", "CSV or JSON for questions and candidates: dry run, row-level errors, then all or nothing."],
  [Gauge, "Question analytics", "Correct and skip rates, common wrong answers, discrimination and a check-the-key flag."],
  [QrCode, "Verifiable results", "A random code and QR on every result, checkable by anyone with masked details only."],
  [Settings2, "Workspace preferences", "Text size, layout, navigator position, theme and reduced motion, saved to the account."],
  [NotebookPen, "Scratchpad", "Per-attempt notes that survive a refresh and are never graded."],
] as const;

/** The eight secondary features as a two-column hairline list. */
export function Features() {
  return (
    <ul className="mt-12 grid border-t border-border sm:grid-cols-2 sm:gap-x-12">
      {FEATURES.map(([Icon, title, body]) => (
        <li key={title} className="grid grid-cols-[2.25rem_1fr] gap-4 border-b border-border py-6">
          <Icon className="mt-0.5 size-5 text-primary" aria-hidden />
          <div>
            <h3 className="font-display text-[17px] font-semibold tracking-[-0.01em]">{title}</h3>
            <p className="mt-1 text-[15px] leading-[1.6] text-muted-foreground">{body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
