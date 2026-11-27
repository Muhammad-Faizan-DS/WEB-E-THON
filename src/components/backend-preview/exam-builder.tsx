"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { examInput, type ExamSettings } from "@/lib/contracts/core";
import type { Question } from "./question-bank";
import { Feedback } from "./common";
import { request, useAction, useResource } from "./client";

export type Exam = {
  id: string; title: string; instructions: string; startsAt: string; endsAt: string; durationMin: number;
  totalMarks: number; status: "draft" | "published"; frozenAt: string | null; resultsPublished: boolean; settings: ExamSettings;
};
export type Enrollment = { id: string; candidateId: string; name: string; email: string; timeMultiplier: number; allowPaste: boolean; status: string };
export type ExamDetail = Exam & { questionIds: string[]; enrollments: Enrollment[] };

function localTime(input: string | number) {
  const date = new Date(input);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function ExamBuilder({ exam, reload }: { exam?: ExamDetail; reload?: () => Promise<void> }) {
  const bank = useResource<Question[]>(exam?.frozenAt ? null : "/api/questions");
  const action = useAction(reload);
  const router = useRouter();
  const frozen = Boolean(exam?.frozenAt);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void action.run(async () => {
      const endsAt = new Date(String(data.get("endsAt"))).toISOString();
      if (exam && frozen) {
        await request("/api/exams", "PATCH", { id: exam.id, endsAt });
        return;
      }
      const blueprint = String(data.get("blueprint")).split(/\r?\n/).filter((line) => line.trim()).map((line) => {
        const [topic, difficulty, count] = line.split("|");
        return { topic: topic.trim(), difficulty: Number(difficulty), count: Number(count) };
      });
      const payload = examInput.parse({
        title: data.get("title"), instructions: data.get("instructions"), startsAt: new Date(String(data.get("startsAt"))).toISOString(),
        endsAt, durationMin: Number(data.get("durationMin")), totalMarks: Number(data.get("totalMarks")), questionIds: data.getAll("questionIds"),
        settings: { blueprint, sequentialReveal: data.has("sequential"), integrityMode: data.get("integrityMode"),
          openLimit: data.get("openLimit") ? Number(data.get("openLimit")) : null,
          cameraCheck: data.has("cameraCheck"), shuffleOptions: data.has("shuffleOptions"), multiSelectRule: data.get("multiSelectRule") },
      });
      const result = await request<ExamDetail>("/api/exams", exam ? "PATCH" : "POST", exam ? { id: exam.id, ...payload } : payload);
      if (!exam) router.push("/examiner/exams/" + result.data.id);
    }, frozen ? "Exam window extended." : "Exam saved.");
  }
  return <section className="panel"><h2>{exam ? "Exam settings" : "Create an exam"}</h2>
    <Feedback error={action.error || bank.error} pending={bank.pending} note={action.note} />
    {frozen && <p className="notice">A candidate has started this exam. You can extend its closing time.</p>}
    <form onSubmit={submit}>
      {!frozen && <>
        <label>Exam title<input name="title" required defaultValue={exam?.title} /></label>
        <label>Instructions<textarea name="instructions" defaultValue={exam?.instructions} /></label>
        <div className="grid three">
          <label>Opens at<input type="datetime-local" name="startsAt" required defaultValue={localTime(exam?.startsAt ?? Date.now() - 60_000)} /></label>
          <label>Duration in minutes<input type="number" name="durationMin" min="1" required defaultValue={exam?.durationMin ?? 30} /></label>
          <label>Total marks<input type="number" name="totalMarks" min="1" required defaultValue={exam?.totalMarks ?? 10} /></label>
        </div>
        <div className="grid three">
          <label>Integrity mode<select name="integrityMode" defaultValue={exam?.settings.integrityMode ?? "review"}><option value="standard">Standard</option><option value="review">Review</option><option value="strict">Strict</option></select></label>
          <label>Multi-select grading<select name="multiSelectRule" defaultValue={exam?.settings.multiSelectRule ?? "all_or_nothing"}><option value="all_or_nothing">All or nothing</option><option value="partial">Partial credit</option><option value="partial_negative">Partial with deductions</option></select></label>
          <label>Open-question limit<input type="number" name="openLimit" min="1" placeholder="Unlimited" defaultValue={exam ? exam.settings.openLimit ?? "" : 5} /></label>
        </div>
        <div className="actions"><label className="check"><input type="checkbox" name="sequential" defaultChecked={exam?.settings.sequentialReveal ?? true} />Sequential reveal</label>
          <label className="check"><input type="checkbox" name="shuffleOptions" defaultChecked={exam?.settings.shuffleOptions ?? true} />Shuffle choices</label>
          <label className="check"><input type="checkbox" name="cameraCheck" defaultChecked={exam?.settings.cameraCheck ?? false} />Camera check</label></div>
        <label>Blueprint<textarea name="blueprint" placeholder="Arithmetic | 1 | 2" defaultValue={exam?.settings.blueprint.map((cell) => [cell.topic, cell.difficulty, cell.count].join(" | ")).join("\n")} />
          <small>One cell per line, with topic, difficulty 1–3, and question count separated by |.</small></label>
        <fieldset><legend>Eligible question pool</legend>{bank.data?.filter((q) => !q.archived).map((q) =>
          <label className="check" key={q.id}><input type="checkbox" name="questionIds" value={q.id} defaultChecked={exam?.questionIds.includes(q.id)} />
            <span>{q.text} <small>{q.topic} · difficulty {q.difficulty} · {q.marks} marks</small></span></label>)}
          {bank.data?.every((q) => q.archived) && <p className="empty">Add active questions in the question bank first.</p>}
        </fieldset>
      </>}
      <label>Closes at<input type="datetime-local" name="endsAt" required defaultValue={localTime(exam?.endsAt ?? Date.now() + 7_200_000)} /></label>
      <div><button className="primary" disabled={action.busy || bank.pending}>{frozen ? "Extend exam window" : "Save exam"}</button></div>
    </form>
  </section>;
}
