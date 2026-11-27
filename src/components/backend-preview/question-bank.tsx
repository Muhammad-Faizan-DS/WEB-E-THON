"use client";

import { useState, type FormEvent } from "react";
import { questionInput, type QuestionInput } from "@/lib/contracts/core";
import { DataTable, Feedback, Heading, Status } from "./common";
import { request, useAction, useResource } from "./client";

export type Question = QuestionInput & { id: string; archived: boolean };
type ImportPreview = { valid: Array<{ row: number; question: QuestionInput }>; errors: Array<{ row: number; message: string }>; imported: number };

export function QuestionBank() {
  const bank = useResource<Question[]>("/api/questions");
  const action = useAction(bank.reload);
  const [edited, setEdited] = useState<Question>();
  const [qtype, setType] = useState<QuestionInput["type"]>("single");
  const [formVersion, reset] = useState(0);
  const [preview, setPreview] = useState<ImportPreview>();
  function edit(question?: Question) {
    setEdited(question);
    setType(question?.type ?? "single");
    reset((value) => value + 1);
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void action.run(async () => {
      const options = qtype === "written" ? [] : String(data.get("options")).split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
        .map((line) => ({ id: crypto.randomUUID(), isCorrect: line.startsWith("*"), text: line.replace(/^\*\s*/, "") }));
      const question = questionInput.parse({ type: qtype, text: data.get("text"), topic: data.get("topic"),
        difficulty: Number(data.get("difficulty")), marks: Number(data.get("marks")), options });
      await request("/api/questions", edited ? "PATCH" : "POST", edited ? { id: edited.id, question } : question);
      edit();
    }, "Question saved.");
  }
  function importFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const commit = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "commit";
    void action.run(async () => {
      const file = data.get("file");
      const content = file instanceof File && file.size > 0 ? await file.text() : String(data.get("content"));
      const result = await request<ImportPreview>("/api/questions/import", "POST", { format: data.get("format"), content, commit });
      setPreview(result.data);
    }, commit ? "Valid questions imported." : "Import preview ready.");
  }
  return <>
    <Heading title="Question bank" note="Create reusable questions and organize them by topic and difficulty." />
    <Feedback error={action.error || bank.error} note={action.note} pending={bank.pending} />
    <div className="layout"><div className="stack">
      <section className="panel"><h2>Your questions</h2>
        <DataTable headers={["Question", "Difficulty", "Marks", "Actions"]} rows={(bank.data ?? []).map((q) => [
          <div key="question">{q.text}<small>{q.topic} · {q.type}</small></div>, q.difficulty, q.marks,
          q.archived ? <Status key="status" value="archived" /> : <div key="actions" className="actions">
            <button onClick={() => edit(q)}>Edit</button><button disabled={action.busy} onClick={() => {
              if (window.confirm("Remove this question from the question bank?")) void action.run(() => request("/api/questions?id=" + q.id, "DELETE"), "Question removed from the active bank.");
            }}>Remove</button></div>,
        ])} /></section>
      <section className="panel"><h2>Import questions</h2>
        <form onSubmit={importFile}>
          <label>Format<select name="format"><option value="csv">CSV</option><option value="json">JSON</option><option value="moodle-xml">Moodle XML</option><option value="gift">GIFT</option></select></label>
          <label>Upload file<input type="file" name="file" accept=".csv,.json,.xml,.gift,.txt" /></label>
          <label>Or paste import content<textarea name="content" /></label>
          <div className="actions"><button disabled={action.busy} value="preview">Preview</button><button disabled={action.busy || !preview?.valid.length} className="primary" value="commit">Import valid rows</button></div>
        </form>
        {preview && <><p className="notice">{preview.valid.length} valid rows, {preview.errors.length} errors, {preview.imported} imported.</p>
          <DataTable headers={["Row", "Issue"]} rows={preview.errors.map(({ row, message }) => [row, message])} /></>}
      </section>
    </div><section className="panel">
      <h2>{edited ? "Edit question" : "New question"}</h2>
      <form key={formVersion} onSubmit={save}>
        <label>Question type<select value={qtype} onChange={(event) => setType(event.target.value as QuestionInput["type"])}>
          <option value="single">Single choice</option><option value="multi">Multiple choice</option><option value="written">Written response</option></select></label>
        <label>Question text<textarea required name="text" defaultValue={edited?.text} /></label>
        <label>Topic<input required name="topic" defaultValue={edited?.topic} /></label>
        <div className="grid"><label>Difficulty<select name="difficulty" defaultValue={edited?.difficulty ?? 1}><option value="1">Easy</option><option value="2">Medium</option><option value="3">Hard</option></select></label>
          <label>Marks<input type="number" required min="1" name="marks" defaultValue={edited?.marks ?? 1} /></label></div>
        {qtype !== "written" && <label>Answer choices<textarea name="options" required defaultValue={edited?.options.map(({ isCorrect, text }) => (isCorrect ? "* " : "") + text).join("\n")} />
          <small>One choice per line. Prefix a correct choice with an asterisk.</small></label>}
        <div className="actions"><button className="primary" disabled={action.busy}>Save question</button>{edited && <button type="button" onClick={() => edit()}>Cancel</button>}</div>
      </form>
    </section></div>
  </>;
}
