"use client";

import { useState, type FormEvent } from "react";
import { sectionInput } from "@/lib/contracts/sections";
import type { QuestionInput } from "@/lib/contracts/core";
import type { ExamDetail, ExamSection } from "./exam-builder";
import { Feedback } from "./common";
import { request, useAction, useResource } from "./client";
import { QuestionEditor, QuestionImport, questionTypes, type ExamQuestion, type ImportMethod } from "./question-entry";

type Method = "manual" | ImportMethod;
const methods: Array<[Method, string, string]> = [
  ["manual", "Write question", "Add a choice or written-response question."],
  ["paste", "Paste text", "Turn copied prompts and choices into questions."],
  ["file", "Upload CSV or file", "Preview rows from CSV, JSON, Moodle XML, GIFT, or TXT."],
  ["archive", "Upload ZIP", "Import questions from several files at once."],
];

export function ExamQuestions({ exam, reload }: { exam: ExamDetail; reload: () => Promise<void> }) {
  const path = `/api/exams/${exam.id}/sections`;
  const [active, setActive] = useState<string>();
  const [creating, setCreating] = useState(false);
  const selected = exam.sections.find(({ id }) => id === active) ?? exam.sections[0];
  const editable = !exam.frozenAt;
  const job = useAction(reload);

  function shift(section: ExamSection, delta: number) {
    const ids = exam.sections.map(({ id }) => id);
    const from = ids.indexOf(section.id);
    const to = from + delta;
    if (to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    void job.run(() => request(path + "/reorder", "PATCH", { sectionIds: ids }), "Section order updated.");
  }

  return <div className="exam-studio">
    <aside className="panel section-rail">
      <div className="section-row"><h2>Sections</h2>{editable && <button onClick={() => setCreating(true)}>Add section</button>}</div>
      <nav className="section-list" aria-label="Exam sections">
        {exam.sections.map((item) => <button key={item.id} aria-pressed={selected?.id === item.id && !creating}
          onClick={() => { setActive(item.id); setCreating(false); }}>
          <strong>{item.title}</strong><small>{item.questionIds.length} {item.questionIds.length === 1 ? "question" : "questions"}</small>
        </button>)}
      </nav>
      {!exam.sections.length && <p className="muted">Add a section to start writing questions.</p>}
      <Feedback error={job.error} note={job.note} />
    </aside>
    <section className="panel section-work">
      {creating ? <SectionForm endpoint={path} onSaved={async (id) => {
        setActive(id); setCreating(false); await reload();
      }} onCancel={() => setCreating(false)} /> : selected ? <SectionWorkspace key={selected.id} section={selected} root={path} editable={editable}
        reload={reload} canMoveUp={exam.sections[0]?.id !== selected.id} canMoveDown={exam.sections.at(-1)?.id !== selected.id}
        onMove={(delta) => shift(selected, delta)} /> : null}
    </section>
  </div>;
}

function SectionWorkspace({ section, root, editable, reload, canMoveUp, canMoveDown, onMove }: {
  section: ExamSection; root: string; editable: boolean; reload: () => Promise<void>;
  canMoveUp: boolean; canMoveDown: boolean; onMove: (delta: number) => void;
}) {
  const endpoint = `${root}/${section.id}/questions`;
  const questions = useResource<ExamQuestion[]>(endpoint);
  const [drawer, setDrawer] = useState<Method | "settings">();
  const [edited, setEdited] = useState<ExamQuestion>();
  const [notice, setNotice] = useState("");
  const refresh = async () => { await Promise.all([questions.reload(), reload()]); };
  const job = useAction(refresh);
  function close() { setDrawer(undefined); setEdited(undefined); }
  async function saved(message: string) {
    close(); setNotice(message); await refresh();
  }
  return <>
    <div className="section-row"><div><h2>{section.title}</h2>{section.instructions && <p>{section.instructions}</p>}
      <p className="muted">{section.questionIds.length} {section.questionIds.length === 1 ? "question" : "questions"}
        {section.marksPerQuestion !== null ? ` · ${section.marksPerQuestion} marks per question` : ""}</p></div>
      {editable && <button onClick={() => { setEdited(undefined); setDrawer(drawer === "settings" ? undefined : "settings"); }}>Section settings</button>}
    </div>
    <Feedback error={questions.error || job.error} note={notice || job.note} pending={questions.pending} />
    {!editable && <p className="notice">Questions are locked because a candidate has started the exam.</p>}
    {editable && drawer === "settings" && <div className="question-editor">
      <SectionForm endpoint={root} section={section} onSaved={() => saved("Section updated.")} onCancel={close} />
      <div className="actions section-controls"><button disabled={!canMoveUp || job.busy} onClick={() => onMove(-1)}>Move up</button>
        <button disabled={!canMoveDown || job.busy} onClick={() => onMove(1)}>Move down</button>
        <button className="danger" disabled={job.busy} onClick={() => {
          if (window.confirm(`Remove "${section.title}" and its questions from this exam?`)) {
            void job.run(() => request(root + "?sectionId=" + section.id, "DELETE"), "Section removed.");
          }
        }}>Remove section</button></div>
    </div>}
    {editable && <div className="question-methods" aria-label="Add questions">
      {methods.map(([method, title, detail]) => <button key={method} aria-pressed={!edited && drawer === method}
        onClick={() => { setNotice(""); setEdited(undefined); setDrawer(method); }}><strong>{title}</strong><small>{detail}</small></button>)}
    </div>}
    {editable && drawer === "manual" && <QuestionEditor key={edited?.id ?? "new"} endpoint={endpoint} question={edited}
      allowed={section.allowedTypes} onSaved={() => saved("Question saved to this section.")} onCancel={close} />}
    {editable && (drawer === "archive" || drawer === "paste" || drawer === "file") &&
      <QuestionImport key={drawer} endpoint={`${root}/${section.id}/import`} method={drawer} onCancel={close}
        onImported={(count) => saved(`${count} ${count === 1 ? "question" : "questions"} added to this section.`)} />}
    {questions.data?.length === 0 && !drawer && <div className="questions-empty"><h3>No questions in this section yet</h3>
      {editable && <p>Choose a method above to add the first question.</p>}</div>}
    {Boolean(questions.data?.length) && <ol className="question-list">
      {questions.data!.map((item) => <li key={item.id}>
        <div><strong>{item.text}</strong><small>{questionTypes[item.type]} · {item.topic} · {section.marksPerQuestion ?? item.marks} marks</small></div>
        {editable && <div className="actions"><button onClick={() => { setNotice(""); setEdited(item); setDrawer("manual"); }}>Edit</button>
          <button disabled={job.busy} onClick={() => {
            if (window.confirm("Remove this question from the exam?")) {
              setNotice(""); void job.run(() => request(endpoint + "?questionId=" + item.id, "DELETE"), "Question removed.");
            }
          }}>Remove</button></div>}
      </li>)}
    </ol>}
  </>;
}

function SectionForm({ endpoint, section, onSaved, onCancel }: {
  endpoint: string; section?: ExamSection; onSaved: (id: string) => Promise<void>; onCancel: () => void;
}) {
  const job = useAction();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void job.run(async () => {
      const blueprint = String(form.get("blueprint")).split(/\r?\n/).filter((line) => line.trim()).map((line) => {
        const [topic, difficulty, count] = line.split("|");
        return { topic: topic.trim(), difficulty: Number(difficulty), count: Number(count) };
      });
      const parsed = sectionInput.safeParse({
        title: form.get("title"), instructions: form.get("instructions"), allowedTypes: form.getAll("allowedTypes"),
        shuffle: form.has("shuffle"), marksPerQuestion: form.get("marksPerQuestion") ? Number(form.get("marksPerQuestion")) : null, blueprint,
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      const response = await request<{ id: string }>(endpoint, section ? "PATCH" : "POST", section ? { id: section.id, ...parsed.data } : parsed.data);
      await onSaved(response.data.id);
    });
  }
  return <form onSubmit={submit}>
    <h3>{section ? "Section settings" : "New section"}</h3><Feedback error={job.error} />
    <div className="grid"><label>Section title<input name="title" required maxLength={150} defaultValue={section?.title} /></label>
      <label>Marks per question<input type="number" name="marksPerQuestion" min="1" max="1000" placeholder="Use individual marks" defaultValue={section?.marksPerQuestion ?? ""} /></label>
      <label className="span">Section instructions<textarea name="instructions" maxLength={8000} defaultValue={section?.instructions} /></label></div>
    <fieldset className="choice-editor"><legend>Allowed question types</legend><div className="actions">
      {(Object.entries(questionTypes) as Array<[QuestionInput["type"], string]>).map(([value, label]) => <label className="check" key={value}>
        <input type="checkbox" name="allowedTypes" value={value} defaultChecked={section?.allowedTypes.includes(value)} />{label}</label>)}</div>
      <small>Leave all unchecked to accept every question type.</small></fieldset>
    <label className="check"><input type="checkbox" name="shuffle" defaultChecked={section?.shuffle ?? true} />Shuffle questions in this section</label>
    <details><summary>Blueprint</summary><label className="form-options">Topic, difficulty and count<textarea name="blueprint" placeholder="Arithmetic | 2 | 4"
      defaultValue={section?.blueprint.map(({ topic, difficulty, count }) => [topic, difficulty, count].join(" | ")).join("\n")} /><small>Use topic | difficulty (1–3) | count per line. Leave empty to include every question in this section.</small></label></details>
    <div className="actions"><button className="primary" disabled={job.busy}>{job.busy ? "Saving…" : "Save section"}</button><button type="button" disabled={job.busy} onClick={onCancel}>Cancel</button></div>
  </form>;
}
