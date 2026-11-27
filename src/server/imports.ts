import Papa from "papaparse";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { account, type questionImport } from "@/lib/contracts/operations";
import { questionInput } from "@/lib/contracts/core";
import { type z } from "zod";
import { accountOrigin, readOrgSettings } from "./accounts";
import { createAccount, knownEmails } from "./admin";
import { ApiError, fail } from "./errors";

type Row = Record<string, unknown>;
type RowError = { row: number; message: string };

function parseCsv(source: string) {
  const csv = Papa.parse<Record<string, string>>(source, {
    header: true, skipEmptyLines: "greedy", transformHeader: (header) => header.trim(),
  });
  return { rows: csv.data, errors: csv.errors.map(({ row, message }) => ({ row: (row ?? 0) + 1, message })) };
}

export async function importUsers(actorId: string, content: string, commit: boolean) {
  const { rows, errors } = parseCsv(content);
  if (rows.length > 100) fail(400, "IMPORT_LIMIT", "Import up to 100 accounts at a time.");
  const seen = await knownEmails(rows.map(({ email }) => email?.trim().toLowerCase()).filter(Boolean));
  const settings = await readOrgSettings();
  const valid = [];
  for (const [index, data] of rows.entries()) {
    const row = index + 1;
    if (errors.some((error) => error.row === row)) continue;
    const parsed = account.safeParse(data);
    if (!parsed.success) { errors.push({ row, message: parsed.error.issues.map((issue) => issue.path.join(".") + ": " + issue.message).join("; ") }); continue; }
    if (seen.has(parsed.data.email)) { errors.push({ row, message: "Email already used." }); continue; }
    try { accountOrigin(parsed.data.email, parsed.data.external, settings); }
    catch (error) {
      if (!(error instanceof ApiError)) throw error;
      errors.push({ row, message: error.message });
      continue;
    }
    seen.add(parsed.data.email);
    const { password, ...profile } = parsed.data;
    if (commit) {
      try { await createAccount(actorId, { ...profile, password }); }
      catch (error) {
        if (!(error instanceof ApiError)) throw error;
        errors.push({ row, message: error.message });
        continue;
      }
    }
    valid.push({ row, ...profile });
  }
  return { valid, errors, imported: commit ? valid.length : 0 };
}

function object(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : value === undefined ? [] : [value];
}

function plain(value: unknown): string {
  return String(object(value).text ?? value ?? "").replace(/<[^>]*>/g, "").trim();
}

function moodle(source: string): Row[] {
  if (/<!DOCTYPE|<!ENTITY/i.test(source) || XMLValidator.validate(source) !== true) {
    fail(400, "INVALID_XML", "Upload valid Moodle XML without document type or entity definitions.");
  }
  const doc = new XMLParser({ ignoreAttributes: false, processEntities: false, parseTagValue: false }).parse(source);
  let topic = "Imported";
  const rows = [];
  for (const question of asArray(object(doc.quiz).question).map(object)) {
    if (question["@_type"] === "category") {
      topic = plain(question.category).split("/").filter(Boolean).at(-1) || "Imported";
      continue;
    }
    const written = question["@_type"] === "essay";
    const type = written ? "written" : question["@_type"] === "multichoice"
      ? (["true", "1"].includes(String(question.single)) ? "single" : "multi") : "unsupported";
    rows.push({ topic, type, difficulty: 2, text: plain(question.questiontext), marks: Number(question.defaultgrade ?? 1),
      options: written ? [] : asArray(question.answer).map(object).map((option, index) => ({
        id: String(index + 1), text: plain(option), isCorrect: Number(option["@_fraction"]) > 0,
      })),
    });
  }
  return rows;
}

function gift(source: string): Row[] {
  const rows = [];
  let topic = "Imported";
  for (const block of source.replace(/^\/\/.*$/gm, "").trim().split(/\r?\n\s*\r?\n/)) {
    const entry = block.trim();
    if (!entry) continue;
    if (entry.startsWith("$CATEGORY:")) { topic = entry.slice(10).trim() || "Imported"; continue; }
    const parsed = /^(?:\s*::.*?::)?([\s\S]*?)\{([\s\S]*)\}\s*$/.exec(entry);
    if (!parsed) { rows.push({ text: entry, type: "unsupported" }); continue; }
    const [, text, raw] = parsed;
    const choices = Array.from(raw.matchAll(/([=~])\s*(?:%(-?\d+(?:\.\d+)?)%)?([^=~]+)/g), (match, index) => ({
      id: String(index + 1), text: match[3].split("#")[0].trim(), isCorrect: match[2] ? Number(match[2]) > 0 : match[1] === "=",
    }));
    const type = !raw.trim() ? "written" : choices.filter(({ isCorrect }) => isCorrect).length > 1 ? "multi" : "single";
    rows.push({ type, topic, text: text.trim(), difficulty: 2, marks: 1, options: choices });
  }
  return rows;
}

function choiceQuestion(text: string, options: Array<{ id: string; text: string }>, answers: string, fields: Row = {}): Row {
  const tokens = new Set(answers.trim().toLowerCase().split(/[,;|]+|\s+(?=[a-t](?:\s|$))/).map((token) => token.trim()).filter(Boolean));
  const marked = new Set<number>();
  for (const token of tokens) {
    const byLabel = options.findIndex((item) => item.id.toLowerCase() === token);
    const byNumber = /^\d+$/.test(token) ? Number(token) - 1 : -1;
    const index = byLabel >= 0 ? byLabel : byNumber >= 0 && byNumber < options.length ? byNumber
      : options.findIndex((item) => item.text.trim().toLowerCase() === token);
    if (index < 0) return { ...fields, text, invalidAnswer: true };
    marked.add(index);
  }
  const key = options.map((item, i) => ({ ...item, isCorrect: marked.has(i) }));
  const correct = marked.size;
  return { ...fields, text, type: fields.type || (key.length ? correct > 1 ? "multi" : "single" : "written"), options: key };
}

function questionCsvRow(row: Record<string, string>): Row {
  const values = Object.fromEntries(Object.entries(row).map(([key, value]) => [key.toLowerCase().replace(/[ _-]/g, ""), value]));
  const text = values.text || values.question || values.questiontext || values.stem;
  const type = ({ mcq: "single", multiplechoice: "single", multiselect: "multi", essay: "written", shortanswer: "written" } as Record<string, string>)[
    values.type?.toLowerCase().replace(/[ _-]/g, "")] ?? values.type?.trim().toLowerCase();
  const fields = { topic: values.topic || "General", difficulty: Number(values.difficulty || 2), marks: Number(values.marks || values.points || 1), type };
  if (values.options) {
    let options: unknown;
    try { options = JSON.parse(values.options); } catch { options = null; }
    return { ...fields, text, options };
  }
  const options = Array.from({ length: 20 }, (_, i) => {
    const id = String.fromCharCode(65 + i);
    return { id, text: values["option" + id.toLowerCase()] || values["option" + (i + 1)] || values[id.toLowerCase()] };
  }).filter((option) => option.text?.trim());
  return choiceQuestion(text, options, values.correctanswer || values.answer || values.correct || "", fields);
}

function pastedQuestions(source: string): Row[] {
  const text = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
  const numbered = /^\s*(?:Q(?:uestion)?\s*)?\d+[.):]\s+/im;
  const blocks = numbered.test(text)
    ? text.split(/\n(?=\s*(?:Q(?:uestion)?\s*)?\d+[.):]\s+)/i)
    : text.split(/\n[ \t]*\n(?=\S)/);
  return blocks.map((block) => {
    const stem: string[] = [];
    const options: Array<{ id: string; text: string }> = [];
    const fields: Row = { topic: "General", difficulty: 2, marks: 1 };
    let key = "";
    for (const line of block.trim().replace(numbered, "").split("\n").map((item) => item.trim())) {
      const choice = /^([A-T])[.)]\s+(.+)$/i.exec(line);
      const meta = /^(correct answers?|answers?|topic|difficulty|marks|points)\s*:\s*(.*)$/i.exec(line);
      if (choice) options.push({ id: choice[1].toUpperCase(), text: choice[2] });
      else if (meta) {
        const label = meta[1].toLowerCase();
        if (label.includes("answer")) key = meta[2];
        else if (label === "topic") fields.topic = meta[2];
        else if (label === "difficulty") fields.difficulty = ({ easy: 1, medium: 2, hard: 3 } as Record<string, number>)[meta[2].toLowerCase()] ?? Number(meta[2]);
        else fields.marks = Number(meta[2]);
      } else if (line) stem.push(line);
    }
    return choiceQuestion(stem.join("\n"), options, key, fields);
  });
}

/** Parses and validates an upload without writing anything. Row numbers are 1-based. */
export function previewQuestions({ format, content }: Pick<z.infer<typeof questionImport>, "format" | "content">) {
  let rows: unknown[];
  let errors: RowError[] = [];
  if (format === "csv") {
    const parsed = parseCsv(content);
    errors = parsed.errors;
    rows = parsed.rows.map(questionCsvRow);
  } else if (format === "moodle-xml") rows = moodle(content);
  else if (format === "gift") rows = gift(content);
  else if (format === "text") rows = pastedQuestions(content);
  else {
    let json: unknown;
    try { json = JSON.parse(content); } catch { fail(400, "INVALID_JSON", "Upload a JSON array of questions."); }
    if (!Array.isArray(json)) fail(400, "INVALID_JSON", "Upload a JSON array of questions.");
    rows = json;
  }
  if (rows.length === 0 || rows.length > 500) fail(400, "IMPORT_LIMIT", "Upload 1 to 500 questions.");
  const valid = rows.flatMap((raw, index) => {
    const row = index + 1;
    if (errors.some((error) => error.row === row)) return [];
    if (object(raw).invalidAnswer === true) {
      errors.push({ row, message: "The answer must match one of the listed choices." });
      return [];
    }
    const parsed = questionInput.safeParse(raw);
    if (parsed.success) return [{ row, question: parsed.data }];
    errors.push({ row, message: parsed.error.issues.map((issue) => issue.path.join(".") + ": " + issue.message).join("; ") });
    return [];
  });
  return { valid, errors };
}

