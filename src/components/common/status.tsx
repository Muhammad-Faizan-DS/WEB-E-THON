import { CalendarClock, CheckCircle2, CircleDashed, CircleDot, FileCheck2, Lock, RotateCcw, Timer, XCircle, PencilLine } from "lucide-react";
import type { CandidateExamStatus, ExamPhase } from "@/contracts";
import { Badge, type BadgeTone } from "@/components/ui/badge";

const CANDIDATE: Record<CandidateExamStatus, { label: string; tone: BadgeTone; icon: typeof Timer }> = {
  not_started: { label: "Not started", tone: "neutral", icon: CircleDashed },
  in_progress: { label: "In progress", tone: "primary", icon: Timer },
  locked: { label: "Locked · waiting for examiner", tone: "warning", icon: Lock },
  submitted: { label: "Submitted · results pending", tone: "info", icon: CheckCircle2 },
  expired: { label: "Time ended · results pending", tone: "info", icon: CheckCircle2 },
  results_published: { label: "Results published", tone: "success", icon: FileCheck2 },
  reattempt_granted: { label: "Re-attempt approved", tone: "primary", icon: RotateCcw },
  missed: { label: "Missed", tone: "danger", icon: XCircle },
};

export function CandidateStatusBadge({ status }: { status: CandidateExamStatus }) {
  const s = CANDIDATE[status];
  const Icon = s.icon;
  return <Badge tone={s.tone}><Icon aria-hidden />{s.label}</Badge>;
}

const PHASE: Record<ExamPhase, { label: string; tone: BadgeTone; icon: typeof Timer }> = {
  draft: { label: "Draft", tone: "neutral", icon: PencilLine },
  scheduled: { label: "Scheduled", tone: "info", icon: CalendarClock },
  ongoing: { label: "Live now", tone: "success", icon: CircleDot },
  completed: { label: "Closed", tone: "neutral", icon: CheckCircle2 },
  results_published: { label: "Results published", tone: "primary", icon: FileCheck2 },
};

export function PhaseBadge({ phase }: { phase: ExamPhase }) {
  const s = PHASE[phase];
  const Icon = s.icon;
  return <Badge tone={s.tone}><Icon aria-hidden />{s.label}</Badge>;
}
