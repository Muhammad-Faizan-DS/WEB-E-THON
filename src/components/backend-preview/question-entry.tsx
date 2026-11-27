"use client";

import { useState, type FormEvent } from "react";
import { questionInput, type QuestionInput } from "@/lib/contracts/core";
import { request, useAction } from "./client";
import { Feedback } from "./common";

export type ExamQuestion = QuestionInput & { id: string; position: number };
export const questionTypes = {
  single: "Single choice", multi: "Multiple choice", written: "Written response",
} satisfies Record<QuestionInput["type"], string>;

const types = Object.keys(questionTypes) as Array<QuestionInput["type"]>;

export function QuestionEditor({ endpoint, question, allowed, onSaved, onCancel }: {
  endpoint: string; question?: ExamQuestion; allowed: QuestionInput["type"][];
  onSaved: () => Promise<void>; onCancel: () => void;
}) {
  const selectable = allowed.length ? allowed : types;
  const [type, setType] = useState(question?.type ?? selectable[0]);
  const [options, setOptions] = useState<QuestionInput["options"]>(() => question?.options.length ? question.options :
    ["A", "B", "C", "D"].map((id) => ({ id, text: "", isCorrect: false })));
  const job = useAction();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void job.run(async () => {
      const parsed = questionInput.safeParse({
        type, text: data.get("text"), topic: data.get("topic"), difficulty: Number(data.get("difficulty")),
        marks: Number(data.get("marks")), options: type === "written" ? [] : options.filter((option) => option.text.trim()),
        ...(question?.course !== undefined ? { course: question.course } : {}),
        ...(question?.tags ? { tags: question.tags } : {}),
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      await request(endpoint, question ? "PATCH" : "POST", question ? { id: question.id, question: parsed.data } : parsed.data);
      await onSaved();
    });
  }

  return <form className="question-editor" onSubmit={submit}>
    <h3>{question ? "Edit question" : "Write a question"}</h3>
    <Feedback error={job.error} />
    <div className="grid three">
      <label>Question type<select value={type} onChange={(event) => {
        const next = event.target.value as QuestionInput["type"];
        setType(next);
        if (next === "single" && options.filter(({ isCorrect }) => isCorrect).length > 1) {
          setOptions(options.map((item) => ({ ...item, isCorrect: false })));
        }
      }}>{selectable.map((value) => <option key={value} value={value}>{questionTypes[value]}</option>)}</select></label>
      <label>Marks<input required type="number" name="marks" min="1" max="1000" defaultValue={question?.marks ?? 1} /></label>
      <label>Difficulty<select name="difficulty" defaultValue={question?.difficulty ?? 2}><option value="1">Easy</option><option value="2">Medium</option><option value="3">Hard</option></select></label>
      <label className="span">Question text<textarea required name="text" maxLength={16000} defaultValue={question?.text} /></label>
      <label>Topic<input name="topic" required maxLength={100} defaultValue={question?.topic ?? "General"} /></label>
    </div>
    {type !== "written" && <fieldset className="choice-editor"><legend>Answer choices</legend>
      <p className="muted">Enter at least two choices and select the correct {type === "single" ? "answer" : "answers"}.</p>
      {options.map((item, index) => <div className="choice-row" key={item.id}>
        <input type={type === "single" ? "radio" : "checkbox"} name="correctChoice" checked={item.isCorrect}
          aria-label={`Choice ${index + 1} is correct`} onChange={(event) => {
            const checked = event.target.checked;
            setOptions((prior) => prior.map((option) => option.id === item.id ? { ...option, isCorrect: checked }
              : type === "single" ? { ...option, isCorrect: false } : option));
          }} />
        <input aria-label={`Choice ${index + 1}`} placeholder={`Choice ${index + 1}`} value={item.text} maxLength={2000} onChange={(event) => {
          const text = event.target.value;
          setOptions((prior) => prior.map((option) => option.id === item.id ? { ...option, text } : option));
        }} />
        {options.length > 2 && <button type="button" aria-label={`Remove choice ${index + 1}`} onClick={() => setOptions((prior) => prior.filter((option) => option.id !== item.id))}>Remove</button>}
      </div>)}
      {options.length < 20 && <button type="button" onClick={() => setOptions((prior) => [...prior, { id: crypto.randomUUID(), text: "", isCorrect: false }])}>Add choice</button>}
    </fieldset>}
    <div className="actions"><button className="primary" disabled={job.busy}>{job.busy ? "Saving…" : "Save question"}</button>
      <button type="button" onClick={onCancel} disabled={job.busy}>Cancel</button></div>
  </form>;
}

export type ImportMethod = "paste" | "file" | "archive";
type ImportFormat = "csv" | "json" | "moodle-xml" | "gift" | "text";
type ImportRow = { source?: string; row: number };
type ImportResult = {
  valid: Array<ImportRow & { question: QuestionInput }>;
  errors: Array<ImportRow & { message: string }>;
  imported: number;
};
const sample = "1. Which planet is closest to the Sun?\nA. Earth\nB. Mercury\nAnswer: B\nMarks: 1\n\n2. Explain why planets orbit the Sun.\nMarks: 3";

export function QuestionImport({ endpoint, method, onImported, onCancel }: {
  endpoint: string; method: ImportMethod; onImported: (count: number) => Promise<void>; onCancel: () => void;
}) {
  const [format, setFormat] = useState<ImportFormat>("csv");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<ImportResult>();
  const job = useAction();
  const zip = method === "archive";
  const paste = method === "paste";
  const label = zip ? "Import a ZIP archive" : paste ? "Paste questions" : "Import a question file";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const commit = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "commit";
    void job.run(async () => {
      if (!paste && !file?.size) throw new Error("Choose a file containing questions.");
      if (file && file.size > (zip ? 2_000_000 : 600_000)) throw new Error(zip ? "Choose a ZIP archive under 2 MB." : "Choose a file under 600 KB.");
      const result = zip
        ? await request<ImportResult>(endpoint + (commit ? "?commit=true" : ""), "POST", file, { "content-type": "application/zip" })
        : await request<ImportResult>(endpoint, "POST", { format: paste ? "text" : format, content: paste ? text : await file!.text(), commit });
      if (result.data.imported > 0) await onImported(result.data.imported);
      else setPreview(result.data);
    }, "Review the rows below before importing.");
  }

  return <form className="question-editor" onSubmit={submit}>
    <h3>{label}</h3>
    <Feedback error={job.error} note={preview ? job.note : undefined} />
    {paste ? <label>Question text<textarea required value={text} rows={8} maxLength={600000} placeholder={sample} onChange={(event) => {
      setText(event.target.value); setPreview(undefined);
    }} /><small>Number each question. Mark choices A., B., and so on, then add an Answer line. For written questions, enter the prompt on its own.</small></label> : <>
      {!zip && <label>File format<select value={format} onChange={(event) => {
        setFormat(event.target.value as ImportFormat); setPreview(undefined);
      }}><option value="csv">CSV</option><option value="json">JSON</option><option value="moodle-xml">Moodle XML</option><option value="gift">GIFT</option><option value="text">Plain text</option></select></label>}
      <label>{zip ? "ZIP file" : "Question file"}<input type="file" required accept={zip ? ".zip,application/zip" : ".csv,.json,.xml,.gift,.txt"} onChange={(event) => {
        const next = event.target.files?.[0];
        setFile(next); setPreview(undefined);
        const detected: Record<string, ImportFormat> = { csv: "csv", json: "json", xml: "moodle-xml", gift: "gift", txt: "text" };
        const ext = next?.name.split(".").at(-1)?.toLowerCase();
        if (ext && detected[ext]) setFormat(detected[ext]);
      }} /></label>
      <p className="muted">{zip ? "Include CSV, JSON, Moodle XML, GIFT, or TXT files. ZIP limit: 2 MB."
        : format === "csv" ? "Use a question column and, for multiple choice, option_a, option_b, and answer. Add topic, difficulty, and marks as needed." : "Use a UTF-8 question file up to 600 KB."}</p>
    </>}
    {preview && <div className="import-preview" aria-live="polite">
      <strong>{preview.valid.length} ready to import{preview.errors.length > 0 ? ` · ${preview.errors.length} issues` : ""}</strong>
      {preview.errors.length > 0 && <ul className="import-issues">{preview.errors.map((row, index) => <li key={index}>
        {row.source ? row.source + (row.row ? " · " : "") : ""}{row.row ? `Row ${row.row}: ` : row.source ? ": " : ""}{row.message}
      </li>)}</ul>}
      {preview.valid.length > 0 && <ul className="import-preview-list">{preview.valid.map((row, index) => <li key={index}>
        {row.question.text}<small>{questionTypes[row.question.type]} · {row.question.marks} {row.question.marks === 1 ? "mark" : "marks"}{row.source ? ` · ${row.source}` : ""}</small>
      </li>)}</ul>}
    </div>}
    <div className="actions"><button className={preview?.valid.length ? undefined : "primary"} value="preview" disabled={job.busy}>{job.busy ? "Processing…" : "Preview questions"}</button>
      {Boolean(preview?.valid.length) && <button className="primary" value="commit" disabled={job.busy}>Import {preview!.valid.length} {preview!.valid.length === 1 ? "question" : "questions"}</button>}
      <button type="button" disabled={job.busy} onClick={onCancel}>Cancel</button></div>
  </form>;
}
