import type { CandidateExamStatus, ExamPhase } from "@/contracts";
import { Status, type BadgeTone } from "@/components/ui/badge";

const CANDIDATE: Record<CandidateExamStatus, { label: string; tone: BadgeTone }> = {
  not_started: { label: "Not started", tone: "neutral" },
  in_progress: { label: "In progress", tone: "primary" },
  locked: { label: "Locked, waiting for examiner", tone: "warning" },
  submitted: { label: "Submitted, results pending", tone: "info" },
  expired: { label: "Time ended, results pending", tone: "info" },
  results_published: { label: "Results published", tone: "success" },
  reattempt_granted: { label: "Re-attempt approved", tone: "primary" },
  missed: { label: "Missed", tone: "danger" },
};

export function CandidateStatusBadge({ status }: { status: CandidateExamStatus }) {
  const s = CANDIDATE[status];
  return <Status tone={s.tone} pulse={status === "in_progress"}>{s.label}</Status>;
}

const PHASE: Record<ExamPhase, { label: string; tone: BadgeTone }> = {
  draft: { label: "Draft", tone: "neutral" },
  scheduled: { label: "Scheduled", tone: "info" },
  ongoing: { label: "Live", tone: "success" },
  completed: { label: "Closed", tone: "neutral" },
  results_published: { label: "Results published", tone: "primary" },
};

export function PhaseBadge({ phase }: { phase: ExamPhase }) {
  const s = PHASE[phase];
  return <Status tone={s.tone} pulse={phase === "ongoing"}>{s.label}</Status>;
}
