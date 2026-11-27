"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { examInput, type ExamSettings, type ExamType } from "@/lib/contracts/core";
import { examPresets, type SectionInput } from "@/lib/contracts/sections";
import { Feedback } from "./common";
import { request, useAction } from "./client";

export type Exam = {
  id: string; title: string; examType?: ExamType; course?: string; instructions: string; startsAt: string; endsAt: string; durationMin: number;
  totalMarks: number; status: "draft" | "published"; frozenAt: string | null; resultsPublished: boolean; settings: ExamSettings;
};
export type Enrollment = { id: string; candidateId: string; name: string; email: string; timeMultiplier: number; allowPaste: boolean; status: string };
export type ExamSection = SectionInput & { id: string; position: number; questionIds: string[] };
export type ExamDetail = Exam & { questionIds: string[]; sections: ExamSection[]; enrollments: Enrollment[] };

function localTime(input: string | number) {
  const date = new Date(input);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

const quiz = examPresets.find((preset) => preset.type === "quiz")!;
function delivery(exam?: ExamDetail) {
  return {
    duration: String(exam?.durationMin ?? quiz.durationMin),
    mode: exam?.settings.integrityMode ?? quiz.settings.integrityMode,
    openLimit: exam ? String(exam.settings.openLimit ?? "") : String(quiz.settings.openLimit ?? ""),
    sequential: exam?.settings.sequentialReveal ?? quiz.settings.sequentialReveal,
    camera: exam?.settings.cameraCheck ?? quiz.settings.cameraCheck,
  };
}

export function ExamBuilder({ exam, reload }: { exam?: ExamDetail; reload?: () => Promise<void> }) {
  const action = useAction(reload);
  const router = useRouter();
  const [kind, setKind] = useState<ExamType>(exam?.examType ?? "quiz");
  const [options, setOptions] = useState(() => delivery(exam));
  const [defaultWindow] = useState(() => {
    const now = Date.now();
    return { start: localTime(now - 60_000), end: localTime(now + 7_200_000) };
  });
  const selected = examPresets.find((preset) => preset.type === kind)!;
  const frozen = Boolean(exam?.frozenAt);

  function applyPreset(type: ExamType) {
    const preset = examPresets.find((item) => item.type === type)!;
    setKind(type);
    if (!exam) setOptions({ duration: String(preset.durationMin), mode: preset.settings.integrityMode,
      openLimit: String(preset.settings.openLimit ?? ""), sequential: preset.settings.sequentialReveal, camera: preset.settings.cameraCheck });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void action.run(async () => {
      const startsAt = frozen ? undefined : new Date(String(data.get("startsAt"))).toISOString();
      const endsAt = new Date(String(data.get("endsAt"))).toISOString();
      if (exam && frozen) {
        await request("/api/exams", "PATCH", { id: exam.id, endsAt });
        return;
      }
      if (startsAt && startsAt >= endsAt) throw new Error("The closing time must be after the opening time.");
      const blueprint = String(data.get("legacyBlueprint") ?? "").split(/\r?\n/).filter((line) => line.trim()).map((line) => {
        const [topic, difficulty, count] = line.split("|");
        return { topic: topic.trim(), difficulty: Number(difficulty), count: Number(count) };
      });
      const parsed = examInput.safeParse({
        title: data.get("title"), examType: kind, course: data.get("course"), instructions: data.get("instructions"),
        startsAt, endsAt, durationMin: Number(options.duration), totalMarks: Number(data.get("totalMarks")),
        settings: { blueprint, sequentialReveal: options.sequential, integrityMode: options.mode,
          openLimit: options.openLimit ? Number(options.openLimit) : null,
          cameraCheck: options.camera, shuffleOptions: data.has("shuffleOptions"), multiSelectRule: data.get("multiSelectRule") },
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      const result = await request<Exam>("/api/exams", exam ? "PATCH" : "POST", exam ? { id: exam.id, ...parsed.data } : parsed.data);
      if (!exam) router.push(`/examiner/exams/${result.data.id}?tab=questions`);
    }, frozen ? "Exam window extended." : "Exam details saved.");
  }

  return <div className="exam-form-wrap">
    {!exam && <div className="exam-crumbs"><Link href="/examiner">Exams</Link><span aria-hidden="true">/</span><span>New exam</span></div>}
    {!exam && <div className="heading exam-heading"><div><h1>Create an exam</h1><p>Set up the exam, then write or import its questions.</p></div></div>}
    <form className="panel exam-form" onSubmit={submit}>
      <Feedback error={action.error} note={action.note} />
      {frozen ? <p className="notice">A candidate has started. You can extend the closing time.</p> : <>
        <section className="form-block">
          <h2>Exam details</h2>
          <div className="grid">
            <label>Exam title<input name="title" required maxLength={200} defaultValue={exam?.title} placeholder="e.g. Statistics midterm" /></label>
            <label>Course or subject<input name="course" maxLength={100} defaultValue={exam?.course} placeholder="e.g. STAT 201" /></label>
            <label>Exam type<select value={kind} onChange={(event) => applyPreset(event.target.value as ExamType)}>
              {examPresets.map(({ type, label }) => <option key={type} value={type}>{label}</option>)}
            </select>{!exam && <small>{selected.description}</small>}</label>
            <label>Total marks<input type="number" name="totalMarks" min="1" max="200000" required defaultValue={exam?.totalMarks ?? 10} /></label>
            <label className="span">Candidate instructions<textarea name="instructions" defaultValue={exam?.instructions} maxLength={16000} /></label>
          </div>
        </section>
        <section className="form-block">
          <h2>Schedule</h2>
          <div className="grid three">
            <label>Opens at<input type="datetime-local" name="startsAt" required defaultValue={exam ? localTime(exam.startsAt) : defaultWindow.start} /></label>
            <label>Closes at<input type="datetime-local" name="endsAt" required defaultValue={exam ? localTime(exam.endsAt) : defaultWindow.end} /></label>
            <label>Duration in minutes<input type="number" min="1" max="1440" required value={options.duration}
              onChange={(event) => setOptions({ ...options, duration: event.target.value })} /></label>
          </div>
        </section>
        <details className="form-block" open={exam ? true : undefined}>
          <summary>Delivery and integrity</summary>
          <div className="grid three form-options">
            <label>Integrity mode<select value={options.mode} onChange={(event) => setOptions({ ...options, mode: event.target.value as ExamSettings["integrityMode"] })}>
              <option value="standard">Standard</option><option value="review">Review</option><option value="strict">Strict</option></select></label>
            <label>Multi-select grading<select name="multiSelectRule" defaultValue={exam?.settings.multiSelectRule ?? "all_or_nothing"}>
              <option value="all_or_nothing">All or nothing</option><option value="partial">Partial credit</option>
              <option value="partial_negative">Partial with deductions</option></select></label>
            <label>Open-question limit<input type="number" min="1" placeholder="Unlimited" value={options.openLimit}
              onChange={(event) => setOptions({ ...options, openLimit: event.target.value })} /></label>
            <label className="check"><input type="checkbox" checked={options.sequential} onChange={(event) => setOptions({ ...options, sequential: event.target.checked })} />Sequential release</label>
            <label className="check"><input type="checkbox" name="shuffleOptions" defaultChecked={exam?.settings.shuffleOptions ?? true} />Shuffle answer choices</label>
            <label className="check"><input type="checkbox" checked={options.camera} onChange={(event) => setOptions({ ...options, camera: event.target.checked })} />Camera check</label>
          </div>
          {Boolean(exam?.settings.blueprint.length) && <label className="form-options">Exam-level blueprint<textarea name="legacyBlueprint"
            defaultValue={exam?.settings.blueprint.map(({ topic, difficulty, count }) => [topic, difficulty, count].join(" | ")).join("\n")} />
            <small>Used for a single section when its own blueprint is empty. Enter topic | difficulty | count.</small></label>}
        </details>
      </>}
      {frozen && <label>Closes at<input type="datetime-local" name="endsAt" required defaultValue={localTime(exam!.endsAt)} /></label>}
      <div className="exam-form-footer"><button className="primary" disabled={action.busy}>{action.busy ? "Saving…" : frozen ? "Extend exam window" : exam ? "Save settings" : "Save draft and add questions"}</button>
        {!exam && <Link className="button" href="/examiner">Cancel</Link>}</div>
    </form>
  </div>;
}

